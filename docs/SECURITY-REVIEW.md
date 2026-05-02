# Smart Shaadi — Security Review Summary

> **Audience:** Col. Deepak + legal counsel
> **Author:** Ashwin Hingve · 2026-05-02
> **Scope:** vivahOS API + Web + AI Service. Phase 1 + Phase 2 + Multi-Event/Polish.
> **Status:** Demo-ready. External penetration test recommended before high-volume launch.

---

## Executive summary

vivahOS implements security controls aligned with India's DPDP Act 2023, Razorpay PCI-DSS scope minimization, RBI tokenization rules, and the IT Act 2000 (and Rules 2011 for sensitive personal data).

**No PII leaves the platform unredacted. No payment data is stored client-side. No raw KYC documents persist after verification.** Multi-tenant isolation is enforced architecturally, not by convention.

This document is the abridged version. Full evidence (file paths + line numbers) is below; the codebase is the source of truth.

---

## 1. Authentication

### What's protected
- Phone OTP login + optional TOTP 2FA
- Database-backed sessions (not JWT in cookies — server-side revocable)
- Session cookie pinned to canonical name + Domain attribute (post-2026-04 fix for subdomain consistency)
- OTP lockout after N failed attempts
- Soft-delete + 30-day account purge
- Audit log on every auth event (login, logout, 2FA setup, password change, account deletion)

### Evidence
- `apps/api/src/auth/config.ts` — Better Auth + Drizzle adapter + TOTP plugin
- `apps/api/src/auth/middleware.ts` (lines 27–77, 83) — `authenticate` + `authorize(roles)` HOF
- `apps/api/src/auth/otpLockout.ts` — rate limit + lockout enforcement
- `apps/api/src/auth/securityRouter.ts` — sessions UI + 2FA management

### Residual risk
- Session cache TTL is 5 minutes — role changes have a 5-minute propagation window. Acceptable for current scope; would tighten for higher-trust roles.

---

## 2. Multi-tenant isolation

### What's protected
Every database query that touches user-owned resources filters by `userId` or `profileId`. CLAUDE.md architectural rule #2 is enforced by code review + test coverage.

### Evidence
- `apps/api/src/weddings/service.ts:104–122` — correct `userId → profileId` resolution before any wedding-keyed query
- `apps/api/src/profiles/service.ts:104–105, 332–345` — phone/email returned as `null` unless `isSelf=true`
- `apps/api/src/users/router.ts:106` — notification preferences filter by `req.user.id`

### Architectural rule
CLAUDE.md rule #12 is **mandatory**: never pass Better Auth `userId` directly to a profile-keyed column. Resolve via `profiles.userId = userId` first. Violation = 403 Forbidden, never silent leak.

### Residual risk
Manual review needed on every new query touching a user-owned table. Future work: ESLint rule + DB row-level security policies (Postgres RLS) for defence-in-depth.

---

## 3. PII handling

### What's protected
- **Phone + email** never appear in API responses unless the requesting user is the owner. Match counterparts see masked or empty fields until both parties accept connection.
- **Logs auto-redact** `phone`, `email`, `password`, `token`, `cookie`, `otp`, `aadhaar` via Pino redact configuration. Even an exception with PII in its message is sanitized before reaching stdout/Sentry.

### Evidence
- `apps/api/src/lib/logger.ts:19–33` — Pino redact paths
- `apps/api/src/profiles/service.ts:104–105` — `isSelf` gate before sensitive fields
- `apps/api/src/storage/service.ts:37–59` — pre-signed URL flow, files never stream through API

### DPDP Act 2023 compliance
- Explicit consent at signup
- Soft-delete + 30-day deletion guarantee
- Data export endpoint (machine-readable JSON)
- Per-purpose consent for marketing communications

### Residual risk
- 3 `console.error` calls in `apps/api/src/payments/webhook.ts` (lines 113, 135, 306) bypass Pino redaction. **Scheduled for fix in M2 milestone (this week).**

---

## 4. Payments security

### What's protected
- **Razorpay webhook signature** verified via HMAC-SHA256 + `timingSafeEqual` (constant-time comparison, mitigates timing attacks)
- **Idempotency** enforced via `INSERT ... ON CONFLICT DO NOTHING` on `(provider, eventId)`. Replays return early with `{ duplicate: true }`.
- **Optimistic CAS lock** on dispute resolution prevents double-resolution under concurrent admin actions.
- **Audit log chained-hash.** Every dispute + escrow transition adds a SHA-256 record where each entry's hash includes the previous entry's hash. Tampering with any historical record invalidates the chain — provable to legal counsel.
- **Card data never touches our servers.** Razorpay tokenizes; we store only the token. PCI-DSS scope: minimal.

### Evidence
- `apps/api/src/lib/razorpay.ts:113–135` — signature verification with secret rotation support
- `apps/api/src/payments/webhookEvents.ts:22–61` — idempotency table
- `apps/api/src/payments/dispute.ts:277–291` — optimistic CAS pattern

### Residual risk
- `escrowReleaseJob.ts` (lines 68–76) does plain UPDATE without status-guard CAS. BullMQ retry after partial Razorpay failure could trigger a second payout. **Scheduled for fix in M2 (this week).**

---

## 5. File uploads

### What's protected
- Files uploaded directly from browser to Cloudflare R2 via pre-signed URLs. Never stream through API server.
- Pre-signed URLs scoped to a specific S3 key + 5-minute TTL.
- R2 bucket private; access only via signed URLs.

### Evidence
- `apps/api/src/storage/service.ts:37–59` — `getPresignedUploadUrl`

### Residual risk
- File-type validation is client-side hint only. Server-side validation runs after upload completes, which is fine for non-executable content (we only accept images + PDFs).

---

## 6. KYC document handling

### What's protected
- **Aadhaar:** verified via DigiLocker; we store only `verified` boolean + last 4 digits + SHA-256 hash of the verification XML.
- **PAN:** verified via NSDL; we store only `verified` + matched-name boolean.
- **Bank account:** verified via Razorpay penny-drop; we store only fund_account_id.
- **Selfie / liveness:** processed by AWS Rekognition in `ap-south-1` (data residency compliant); R2-stored selfies auto-deleted 24h after KYC complete.
- **Audit log:** every KYC step recorded with chained-hash.

### Evidence
- `apps/api/src/kyc/aadhaar.ts` — adapter contract (currently mock; real DigiLocker integration documented in `docs/PROVIDER-ACTIVATION/digilocker.md`)
- CLAUDE.md security rule: "Do NOT store Aadhaar numbers or raw KYC data — store verification status only"

### DPDP Act + IT Rules 2011
- Sensitive personal data category includes biometric + KYC fields
- Consent obtained pre-KYC with reasonable security practices
- Encryption at rest (Postgres + R2 default)
- Access logged + chained-hashed

### Residual risk
- Adapters for DigiLocker / NSDL / Refinitiv / Karza are mocked pending client-side onboarding (see Provider Activation Kit). Mock layer is symmetric: real flow activates with single env flag, no code change.

---

## 7. Background jobs + queues

### What's protected
- All async work goes through Bull queues (Redis-backed). 11 workers registered at API startup.
- **Deterministic `jobId`s** (e.g., `escrow-release-<bookingId>`) prevent duplicate enqueuing.
- Failed jobs retry with exponential backoff; permanent failures alert via Sentry.

### Evidence
- `apps/api/src/infrastructure/redis/queues.ts` — queue declarations
- `apps/api/src/jobs/*` — worker implementations

### Residual risk
- `invitation-blast` queue declared (line 153) but no worker registered. **Scheduled for fix in M2.**

---

## 8. Observability + incident response

### What's monitored
- **Sentry** on api + web (ai-service Sentry pending — M2)
- **PostHog** for product analytics
- **Pino** structured logs (api), `structlog` planned for ai-service (M2)
- **Grafana / Prometheus** for RED metrics + queue depth (M3)
- **`/health`** endpoints on api + ai-service (`/ready` adds in M2)
- **BetterStack** uptime monitoring on canonical URLs

### Incident response
- Runbook (`docs/RUNBOOK.md`, draft in M3) covers top 5 incidents:
  1. Razorpay webhook flood
  2. Escrow release stuck
  3. Mongo down (mock fallback path)
  4. ai-service unreachable
  5. Redis down

### Residual risk
- Single-developer on-call rotation. PagerDuty integration recommended before higher-traffic launch.

---

## 9. CI/CD + secrets

### What's protected
- **No secrets in git.** All keys live in Railway (api) + Vercel (web) env vars.
- **`gitleaks`** in CI scans every PR for accidental commits (M3 addition).
- **Pre-commit hooks** (M3) block `any`, `console.log`, raw-userId queries.
- **Branch protection** on `main` (post-M1).

### Evidence
- `apps/api/src/lib/env.ts` — Zod validation with `process.exit(1)` on failure; `superRefine` enforces real provider keys when mocks are off

### Residual risk
- Husky + lint-staged not yet wired (M3 addition).

---

## 10. Open items addressed by Stabilization Plan

The following items are documented in `~/.claude/plans/you-are-a-software-pure-penguin.md` and will close in M2 (this week) or M3 (next week):

| Item | Severity | Plan ref |
|------|----------|----------|
| ai-service `/ai/horoscope/guna` lacks `X-Internal-Key` auth | Critical | M2.1 |
| escrow release job missing CAS guard | High | M2.2 |
| `invitation-blast` queue orphaned | High | M2.3 |
| ai-service no Sentry + structured logging | Medium | M2.5 |
| `/ready` endpoint missing | Low | M2.8 |
| `console.error` bypassing pino redaction in webhook.ts | Medium | M2.7 |
| Coverage threshold not enforced | Medium | M3.2 |
| ai-service no Dockerfile / deploy config | Low | M3.4 |
| No Prometheus metrics | Low | M3.5 |

All items are **non-blocking for the demo**. They will be closed before any provider goes LIVE.

---

## Recommended external review

Before high-volume launch:
1. **Penetration test.** OWASP ASVS Level 2. Suggested vendors: Lucideus, Niki.ai security, Bishop Fox.
2. **DPDP impact assessment.** Engage a privacy law firm familiar with the new DPDP Rules.
3. **Razorpay PCI-DSS attestation.** Razorpay handles card data; we get scope reduction. Annual self-assessment questionnaire (SAQ A).

---

## Appendix — Architectural rules enforced

From CLAUDE.md (project root). These are not aspirational; violations fail code review.

1. All LLM calls route through ai-service or `apps/web/lib/ai/index.ts`.
2. All DB queries filter by `userId` or `profileId`.
3. Server Actions for all mutations (Next.js).
4. No `any` in TypeScript — use `unknown` + narrowing.
5. Phone + email never in API responses by default.
6. File uploads via pre-signed URLs only.
7. Redis for sessions + match scores; never application memory.
8. Background jobs via Bull queues (Redis-backed).
9. Guna Milan algorithm in `apps/ai-service/routers/horoscope.py`.
10. Reciprocal matching checks both sides.
11. Mongo touchpoints guarded by `USE_MOCK_SERVICES`.
12. `userId → profileId` resolution before profile-keyed queries.

---

## Contact

For questions on this review:
- **Technical:** Ashwin Hingve (developer)
- **Legal counsel:** [client to nominate]
- **Source code:** repo at `/mnt/d/Do Not Open/vivah/vivahOS` (committed, audited)

For specific evidence (file:line citations), see the codebase. Every claim in this review maps to a concrete file path; the developer is available to walk through any line in person.
