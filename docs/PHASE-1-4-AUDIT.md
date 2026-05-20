# Smart Shaadi — Phase 1-4 Pre-Launch Completeness Audit

**Date:** 2026-05-20 · **Method:** read-only grep + code inspection across
`apps/api/src`, `apps/web/src`, `apps/ai-service/`. Every item has an
evidence file path; mock-dependent paths are flagged. This is the inventory
the go-live decision should be made against.

---

## Executive Summary

| | Count | % |
|---|---:|---:|
| **Total items audited** | **143** | 100 % |
| ✅ Shipped | 105 | **73 %** |
| 🟡 Partial | 29 | 20 % |
| 🔴 Missing | 9 | 6 % |

**P0 launch blockers:** ~~**8**~~ → **4 open** (4 closed in Sprint 0 Part 1) ·
total effort to close (code only): **~14 h** · plus **3 external business
registrations** (MSG91 DLT, DigiLocker partnership, Razorpay live account)
that gate the remaining work and take **weeks**, not hours, in regulatory
lead time.

### Resolution log

| Date | P0 # | Closed by |
|---|---|---|
| 2026-05-20 | **P0-3** `USE_MOCK_SERVICES=true` in `.env.production` | flipped to `false` in `apps/api/.env.production` + `.env.production.example`; env.ts now hard-rejects the combination |
| 2026-05-20 | **P0-5** `MOCK_OTP_VALUE=123456` backdoor | env.ts schema removes the default; superRefine requires explicit value when mock mode is on |
| 2026-05-20 | **P0-6** CI hostname `api.smart_shaadi.in` (RFC-invalid) | `.github/workflows/ci.yml:118` + `docs/API.md:3` → `api.smartshaadi.co.in` |
| 2026-05-20 | **P0-7** Sentry web `instrumentation.ts` missing | created at `apps/web/instrumentation.ts`; runbook for Vercel/Railway secrets in `docs/PROVIDER-ACTIVATION/sentry.md` |

The evidence sections below are preserved as a historical snapshot — they
describe the state at audit publication. Resolved items are listed here.

### Go-live recommendation: **WAIT** (not today, not this sprint)

| Window | Verdict |
|---|---|
| **Today** | ❌ NO. App cannot send a single OTP, cannot verify identity, cannot process real INR. `USE_MOCK_SERVICES=true` ships a demo, not a product. |
| **5-day code sprint (40 h)** | ⚠️ Closes every *technical* P0 (Sentry, CI typos, plan IDs, OTP backdoor, monitoring) but **not** MSG91 / DigiLocker / Razorpay live — those are out-of-band business processes. After the sprint, code is launch-ready; the platform is not. |
| **After external registrations land** (~2–8 weeks) | ✅ Codebase is well-tested, P0 hardening is in (the 10 reviewed items are all closed), escrow / bookings / weddings are production-quality. Flip `USE_MOCK_SERVICES=false`, wire the real keys, ship. |

The codebase quality is **higher than the production-readiness state**.
Architecture is sound, mocks are cleanly gated, hardening is comprehensive.
The gap is **operational** (env values, third-party signups), not structural.

---

## P0 — Launch Blockers (8)

### P0-1 — MSG91 OTP is not wired; auth is broken in production
**Files:** `apps/api/src/auth/config.ts:129-135`
**Evidence:** the `sendOTP` Better-Auth callback throws unconditionally outside
`USE_MOCK_SERVICES=true` (`throw new Error('MSG91 integration not yet implemented')`).
The `apps/api/src/notifications/providers/msg91.ts` HTTP stub exists but the
auth path never calls it. **Zero real users can register or log in.**
**Fix:** swap the stub for the real MSG91 send-OTP request (HMAC-templated,
DLT-registered sender).
**Effort:** **4–8 h** code + **2–4 weeks** for MSG91 DLT template approval (external).

### P0-2 — DigiLocker + Liveness + Face-match are all `throw` stubs
**Files:** `apps/api/src/kyc/aadhaar.ts:23,37` · `apps/api/src/kyc/liveness.ts:36` ·
`apps/api/src/kyc/faceMatch.ts:37`
**Evidence:** all three throw `Error('Real X provider not yet configured')`
in real mode. Mock path auto-sets `verificationStatus='VERIFIED'` without
any check — gives **false confidence** in dev testing. The trust/safety
proposition of the platform doesn't exist until these are wired.
**Fix:** DigiLocker OAuth SDK + AWS Rekognition `CompareFaces` + a real
liveness model (or third-party liveness API).
**Effort:** **40–80 h** code + **~2–3 months** for DigiLocker partnership
approval (external).

### P0-3 — `USE_MOCK_SERVICES=true` checked into `.env.production`
**File:** `apps/api/.env.production:38`
**Evidence:** the file on disk has `USE_MOCK_SERVICES=true` with every
third-party key set to `placeholder`. Everything mocks: Razorpay, MSG91,
DigiLocker, Rekognition, Daily.co, R2 (unless `R2_LIVE=true`), MongoDB
(unless `MONGO_LIVE=true`). The comment acknowledges "keep true until
Razorpay/MSG91/DigiLocker registered" — this is the explicit known
pre-launch state.
**Fix:** complete external registrations → flip flag → set real credentials
→ verify in staging.
**Effort:** **~16 h** code + flag-flip + smoke tests, dominated by external
business registration lead time.

### P0-4 — Razorpay subscription plan IDs are hardcoded `mock_plan_*`
**File:** `apps/api/src/payments/subscriptions.ts:42,53,64,75`
**Evidence:** plan IDs are string literals like `'mock_plan_standard_monthly'`.
Real Razorpay rejects unknown `plan_id` strings with HTTP 400. **Every
vendor subscription attempt errors in production** once Razorpay is live.
**Fix:** create 4 plans in Razorpay Dashboard → add `RAZORPAY_PLAN_*` env
vars → swap the 4 literals.
**Effort:** **2 h**.

### P0-5 — `MOCK_OTP_VALUE=123456` is a default backdoor in every mock-mode env
**File:** `apps/api/src/lib/env.ts:39`
**Evidence:** any deployed environment with `USE_MOCK_SERVICES=true` (today
that includes the production config) accepts OTP `123456` for **every phone
number**. An attacker who knows a target's phone can log in with no SMS
verification. Includes staging / UAT / demo environments today.
**Fix:** override `MOCK_OTP_VALUE` with `openssl rand -hex 4` in every
deployed env that uses mock mode; warn in env schema.
**Effort:** **15 min per environment**, **0 h code** (already documented at
`env.ts:39`).

### P0-6 — CI build uses an invalid DNS hostname for the API
**File:** `.github/workflows/ci.yml:118`
**Evidence:** `NEXT_PUBLIC_API_URL: https://api.smart_shaadi.in` — underscores
are forbidden in DNS hostnames per RFC 1123. If the real domain is
`smart-shaadi.in` (hyphenated), every client-side fetch in the deployed web
app silently 404s. Web app is dead from day one.
**Fix:** verify the actual Railway domain, correct underscore → hyphen.
**Effort:** **15 min**.

### P0-7 — Sentry web `instrumentation.ts` missing → server errors silently swallowed
**File:** `apps/web/src/instrumentation.ts` (does NOT exist)
**Evidence:** Next 14+ App Router does NOT auto-load `sentry.server.config.ts`;
it requires `instrumentation.ts` to bootstrap. The web `sentry.server.config.ts`
and `sentry.client.config.ts` are present but the server one is never
imported. Combined with no `SENTRY_DSN` in `apps/web/.env`, **zero
production error observability on the web app's server side** (Server
Actions, Route Handlers, RSC errors → ⃠ silent).
**Fix:** create `apps/web/src/instrumentation.ts` + set DSN env vars in
Vercel + add `SENTRY_AUTH_TOKEN/ORG/PROJECT` for source maps.
**Effort:** **3 h**.

### P0-8 — Sentry source-maps never uploaded; CI has no upload step
**File:** `.github/workflows/ci.yml` (no Sentry job) · `apps/web/next.config.ts:24-30`
(only wraps with `withSentryConfig` if `SENTRY_AUTH_TOKEN/ORG/PROJECT` all set,
which they aren't).
**Evidence:** all production stack traces will show minified `chunks/X.js:1:128`
positions — undebuggable.
**Fix:** add `SENTRY_AUTH_TOKEN/ORG/PROJECT` to Vercel envs; CI release step
runs `@sentry/cli upload-sourcemaps`.
**Effort:** **1 h**.

**P0 totals:** **8 items · ~14 h code + 3 external lead-times (~weeks to months)**.

---

## P1 — High Priority (15)

| # | Item | Evidence | Effort |
|---|---|---|---:|
| P1-1 | JWT spec mismatch — claimed "15m access / 30d refresh", actual is a 30-day Better-Auth session cookie (no JWT split) | `apps/api/src/auth/config.ts:41` | 1 h docs / 16-24 h implement |
| P1-2 | `handlePaymentSuccess` non-atomic idempotency — no conditional `WHERE status='PENDING'` guard | `apps/api/src/payments/service.ts:139-146` | 2 h |
| P1-3 | `acceptRequest` read-then-write race in matchmaking | `apps/api/src/matchmaking/requests/service.ts:237-254` | 2 h |
| P1-4 | AI service pytest **not in CI** — 13 `test_*.py` never executed; regression in Guna Milan or any model bundle ships undetected | `.github/workflows/ci.yml` (no Python job) | 4 h (incl. fixing 9 known collection errors) |
| P1-5 | E-invoicing (NIC IRP) — env var declared, no implementation | `apps/api/src/lib/env.ts:86` (`EINVOICE_API_KEY`), no `payments/invoice.*` | 8-16 h |
| P1-6 | `PLATFORM_GSTIN` hardcoded fake `27AAAAA0000A1Z5` default, raw `process.env` | `apps/api/src/payments/invoiceService.ts:26-27` | 1 h |
| P1-7 | Dashboard "Recent Conversations" always empty (no chat fetch wired) | `apps/web/src/app/(app)/dashboard/page.tsx` | 2-4 h |
| P1-8 | Admin vendor-approval queue is a "coming soon" placeholder — no workflow to approve newly-registered vendors | `apps/web/src/app/(app)/admin/page.tsx:361` | 8-12 h |
| P1-9 | Conversation Coach reads `ANTHROPIC_API_KEY` via raw `os.getenv("ANTHROPIC_API_KEY","")` — empty string accepted, fails at first call | `apps/ai-service/src/services/coach_service.py:61` | 2 h |
| P1-10 | HuggingFace XLM-RoBERTa model not pre-warmed in Docker — first request triggers ~1 GB cold download in Railway | `apps/ai-service/src/services/sentiment_model.py:25`, no Dockerfile warmup | 3 h |
| P1-11 | Daily.co integration is fully mocked — production validation catches `'mock-daily-key'` but no Daily.co account provisioned | `apps/api/src/lib/dailyco.ts:2`, env `DAILY_CO_API_KEY='mock-daily-key'` | 1 h env (after Daily.co sign-up) |
| P1-12 | Profile block-button still wired to a TODO comment | `apps/web/src/components/profile/ProfileActions.client.tsx:17` | 1-2 h |
| P1-13 | Webhook idempotency test missing duplicate-replay case (covers signature + happy paths only) | `apps/api/src/payments/__tests__/webhook.test.ts` (7 cases, no replay) | 1 h |
| P1-14 | `.env.production.example` missing 11 envs that `.env.example` documents (`SENTRY_DSN`, `METRICS_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `AWS_SES_*`, `EINVOICE_API_KEY`, `RAZORPAY_ACCOUNT_ID`, etc.) | `apps/api/.env.production.example` | 1 h |
| P1-15 | BetterStack uptime monitors documented but not confirmed active — manual setup, no provisioning code | `docs/monitoring/betterstack-setup.md` | 1 h ops |

---

## P2 — Polish, deferrals, spec-vs-reality mismatches (~20)

| # | Item | Evidence | Effort |
|---|---|---|---:|
| P2-1 | "Silent decline" sends a `MATCH_DECLINED` notification — sender learns the outcome (reason is hidden). True silent-decline (no notification) was advertised | `apps/api/src/matchmaking/requests/service.ts:330-332` | 4-6 h (if true silence required) |
| P2-2 | Contact unlock is on a **separate endpoint** (`/profiles/:id/contact`), not injected into the main profile detail response — even mutual-match viewers see `phoneNumber: null` on `GET /profiles/:id` | `apps/api/src/profiles/service.ts:33,104-105` | (architecture call — not a bug) |
| P2-3 | "Reciprocal matching" — feed shows all scored candidates, not a Tinder-style mutual-like gate. Aligns with matrimony-app norms but mismatches the literal CLAUDE.md spec | `apps/api/src/matchmaking/engine.ts:440` | 4-8 h (only if true mutual-like gate is desired) |
| P2-4 | Hindi-English translation is coupled to the Mongo mock guard — disabling Mongo also disables translation | `apps/api/src/chat/router.ts:539` (`if (shouldUseMockMongo)`) | 2 h (decouple guard) |
| P2-5 | `expireGracePeriodsJob` runs hourly, not 02:00 IST as CLAUDE.md says (functionally safer, just a spec mismatch) | `apps/api/src/jobs/expireGracePeriodsJob.ts:33` (`'0 * * * *'`) | 15 min (either change pattern or update spec) |
| P2-6 | DPI bundle is missing the `feature_groups` key documented in CLAUDE.md Phase 3 bundle shape | `apps/ai-service/src/services/dpi_model.py:71-77` | 1 h |
| P2-7 | AI service `/health` test asserts only `status == "ok"` — does not assert the `models` map | `apps/ai-service/tests/test_health.py` | 1 h |
| P2-8 | 10 raw `process.env` reads bypass the typed `env.ts` schema across the API | `index.ts:122`, `auth/securityRouter.ts:303`, `chat/socket/index.ts:31`, `kyc/rekognition.ts:59,94`, `lib/logger.ts:16`, `lib/mockStore.ts:16-17`, `payments/invoiceService.ts:26-27` | 3 h |
| P2-9 | Six raw `<img>` tags remain in non-core pages (rentals, store, two-factor, create profile, etc.) | Day-7 lint warnings | (deferred — Day-7 summary item) |
| P2-10 | `/feed` First Load JS is **221 kB** (target 200 kB) — 12 kB perf saved by Day-7 commit `e49117d`; remaining 21 kB gap needs lazy ProfileCard or framer-motion split | `pnpm build` route table | (deferred — see Day-7 summary) |
| P2-11 | `text-muted-foreground` vs `text-text-muted` token-name unify (same hex, ~30 files) | Day-7 summary | (deferred — cosmetic) |
| P2-12 | `jain` slug collision — appears in both `castes` and `communities` arrays; `resolveSlug()` disambiguation needs a uniqueness test | `apps/web/src/lib/seo-data.ts:7,20` | 2 h |
| P2-13 | EMI payment method not explicitly enabled in `createOrder()` — relies on Razorpay Dashboard config | `apps/api/src/lib/razorpay.ts` | 1 h |
| P2-14 | MongoDB VendorPortfolio skipped in mock mode (requires `MONGO_LIVE=true` explicit env) | `apps/api/src/vendors/service.ts:247-257` | 0 h code / env config |
| P2-15 | No dedicated `admin/escrow.test.ts`; escrow tested indirectly via payments/dispute tests | `apps/api/src/admin/escrow.ts` | 2 h |
| P2-16 | `release` job in CI is a comment-only stub — Vercel auto-deploy implied but not scripted, no post-deploy health check | `.github/workflows/ci.yml` | 2 h |
| P2-17 | TILAK/SAGAN PostgreSQL enum still contains the removed values (intentional — PG can't `DROP VALUE`; app-layer Zod/Mongoose enforces) | `packages/db/schema/index.ts:189-190` | (design call — already documented) |
| P2-18 | `RolePicker` only shows 4 of 6 roles (`INDIVIDUAL`/`FAMILY_MEMBER`/`VENDOR`/`EVENT_COORDINATOR`); no admin-provisioning docs for `ADMIN`/`SUPPORT` (correct security default, but operational doc missing) | `apps/web/src/app/(auth)/register/role/RolePicker.client.tsx:10-31` | 30 min (docs) |
| P2-19 | No web `.env.example` — `apps/web/` has no template for operators | (file absent) | 30 min |
| P2-20 | E2E (Playwright) silently skips when `secrets.VERCEL_PREVIEW_URL` is unset — no warning, no failure | `.github/workflows/ci.yml` e2e job | 30 min |

---

## What IS production-quality (the wins worth keeping)

To balance the criticisms above, the following modules are **launch-grade**
with comprehensive tests and no significant gaps:

- **Escrow / disputes** — 9/9 items ✅; most-tested module in the repo. Optimistic
  locking, DB-before-Razorpay with `*_PENDING` fallbacks, deterministic
  cancel-by-jobId, full audit trail (`payments/__tests__/dispute.test.ts`
  covers Fix 1-5).
- **Wedding planner** — 10/10 items ✅; full CRUD, sub-routers all mounted,
  Mohit-QA fixes shipped (date validation, edit/cancel, custom ceremony,
  budget edit, vendor assign, bulk guests).
- **Rentals + Store** — 7/7 items ✅; tx-wrapped overbook guard, `availableQty`,
  public browse, crash-guarded confirm.
- **Guna Milan** — all 8 Ashtakoot factors present; **105 pytest cases pass**.
- **All 10 P0 hardening items** from `docs/phase1-2-code-review.md` are
  closed (SSRF DNS-rebinding, booking double-book race, webhook idempotency,
  OTP brute-force lockout, JWT iss/aud, R2 pre-signed content-type, paise
  rounding, match-accept TOCTOU, PII leak, raw-body webhook handling).
- **Mock/real architecture** is clean — `USE_MOCK_SERVICES` + granular
  `MONGO_LIVE` / `R2_LIVE` overrides; production guards in `env.ts`
  positively reject `'mock-*'` placeholder values when mock-mode is off.
- **All MongoDB `ProfileContent` writers** are correctly `shouldUseMockMongo`-
  guarded per CLAUDE.md rule 11 (audited: every reader and writer).
- **CI gate** runs lint + type-check + tests against real Postgres 16 +
  Redis 7 service containers on every PR.

---

## Recommended go-live sequence

### Today (do nothing in production)
Treat current state as **internal demo only**. `123456` OTP backdoor and
mock payments mean anyone with the URL is a "user".

### Sprint 0 — 5-day code-only sprint (40 h)
Close every P0 that doesn't require external registration:
- **P0-4** Razorpay plan IDs (2 h)
- **P0-5** Random `MOCK_OTP_VALUE` in every env (15 min)
- **P0-6** CI domain underscore (15 min)
- **P0-7** `instrumentation.ts` + DSN env vars (3 h)
- **P0-8** Sentry source-map upload (1 h)
- **P1-4** AI pytest in CI (4 h) — biggest test-coverage win
- **P1-9** Coach API key in typed env (2 h)
- **P1-1, P1-13, P1-14, P1-15, P2-2, P2-5, P2-7** — docs/spec align (4 h)
- Remaining buffer (~24 h) → P1-2/P1-3 idempotency hardening, P1-12 block-button wiring, P2-12 slug uniqueness test, etc.

**Output:** every technical P0 closed, every "spec lies" fixed in docs,
test coverage materially better. Codebase ready for real users.

### External-blocker window (weeks–months in parallel)
- MSG91 DLT template registration (P0-1) — ~2-4 weeks
- Razorpay live account + KYC (P0-3, P0-4) — ~1 week
- DigiLocker partnership (P0-2) — ~2-3 months
- AWS Rekognition account (P0-2) — ~1 day
- Daily.co account (P1-11) — ~1 day

### Sprint 1 — Integration sprint (after external blockers land)
Wire the real services, flip `USE_MOCK_SERVICES=false`, smoke-test every
gated path in staging, then production. **At this point the platform is
launch-ready.**

---

## Footer

This audit was generated 2026-05-20 against the working tree at HEAD after
the Day-7 perf commit (`e49117d`). Re-run it after **every** sprint and
**before** any go-live decision. Treat any new ✅ → 🟡 or ✅ → 🔴
regression as a release blocker.
