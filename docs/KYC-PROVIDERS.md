# KYC Providers — Decision Matrix

> **Purpose.** Maps each KYC adapter in `apps/api/src/kyc/` to its real-world provider, integration effort, and lead time. Companion to `docs/PROVIDER-ACTIVATION/`.

---

## Adapters and provider choices

| Adapter file | What it verifies | Provider (recommended) | Status | Activation runbook |
|--------------|------------------|------------------------|--------|---------------------|
| `aadhaar.ts` | Aadhaar number + name match | DigiLocker (govt-issued) | TODO stub | `PROVIDER-ACTIVATION/digilocker.md` |
| `pan.ts` | PAN number + name match | NSDL e-Gov | TODO stub | `PROVIDER-ACTIVATION/nsdl-pan.md` |
| `bank.ts` | Bank account ownership (penny-drop) | Razorpay Fund Account | TODO stub | `PROVIDER-ACTIVATION/razorpay-fund-account.md` |
| `faceMatch.ts` | Selfie ↔ ID photo similarity | AWS Rekognition `CompareFaces` | TODO stub | `PROVIDER-ACTIVATION/aws-rekognition.md` |
| `liveness.ts` | Real-person video challenge | AWS Rekognition `FaceLiveness` | TODO stub | `PROVIDER-ACTIVATION/aws-rekognition.md` |
| `criminal.ts` | Criminal record across India eCourts | Karza (or AuthBridge / IDfy) | TODO stub | `PROVIDER-ACTIVATION/ecourts-criminal.md` |
| `sanctions.ts` | OFAC / EU / UN watchlists + PEP | Refinitiv WorldCheck One | TODO stub | `PROVIDER-ACTIVATION/refinitiv-worldcheck.md` |
| `rekognition.ts` | Internal helper for face-collection ops | AWS Rekognition (same IAM) | partial impl | `PROVIDER-ACTIVATION/aws-rekognition.md` |
| `audit.ts` | Chained-hash audit log writer | (internal — no provider) | implemented | — |
| `rateLimit.ts` | Per-user KYC throttle | (internal — Redis) | implemented | — |
| `risk.ts` | Risk score aggregator | (internal — composes provider results) | implemented | — |

---

## Per-adapter integration effort estimate

| Adapter | Real impl effort | Provider lead time | Combined unblock time |
|---------|------------------|---------------------|----------------------|
| `aadhaar.ts` | 1 day (OAuth2 + XML signature verify) | 4 weeks (MoU) | ~4 weeks |
| `pan.ts` | 0.5 day (REST call + name-match logic) | 2–3 weeks | ~3 weeks |
| `bank.ts` | 0.5 day (Razorpay penny-drop API) | bundles with Razorpay LIVE | ~1 week |
| `faceMatch.ts` | 0.5 day (CompareFaces API) | 1 day (IAM) | 1–2 days |
| `liveness.ts` | 1 day (frontend SDK + backend verify) | 1 day (IAM) | 2 days |
| `criminal.ts` | 1 day (async webhook + status mapping) | 1–2 weeks | ~2 weeks |
| `sanctions.ts` | 1 day (REST + admin review queue) | 4–6 weeks | ~6 weeks |

Total developer effort to swap all stubs for real impls: **~5 days**, gated entirely on the slowest provider lead time.

---

## Why TODO stubs and not real impls today

The plan ships the **adapter contracts** (function signatures, mock returns matching the real provider response shape) before the provider agreements are signed. This decouples backend development from external onboarding.

When agreements arrive, each stub becomes a 0.5–1 day swap. The mock-mode code path stays in place as the rollback target.

Critical CLAUDE.md rule: **no raw KYC document data persists**. Every adapter stores only `{ verified: boolean, verified_at: timestamp, last4: string, hash: sha256 }`. Raw documents (Aadhaar XML, PAN response, etc.) are processed in-memory, hashed for audit, then discarded.

---

## Risk score composition (`risk.ts`)

The aggregator in `apps/api/src/kyc/risk.ts` composes adapter results into a single `KYC_TIER` (1, 2, or 3):

| Tier | Required adapters | Premium feature? |
|------|-------------------|------------------|
| Tier 1 (basic) | Phone OTP + email confirm | No (default) |
| Tier 2 (standard) | + PAN + bank + face match + liveness | No (free) |
| Tier 3 (premium) | + Aadhaar + criminal + sanctions | Yes (₹499 one-time) |

Profile visibility, contact unlock thresholds, and trust badges all key off the tier number — set in `apps/api/src/auth/requireTier.ts`.

---

## Recommended activation order (KYC-only)

If activating KYC providers in isolation (i.e., separate from the main provider switch-on):

1. **AWS Rekognition** (Day 1) — face match + liveness, fast
2. **Razorpay Fund Account → bank.ts** (after Razorpay LIVE) — penny-drop
3. **NSDL → pan.ts** (Week 2–3) — second-fastest KYC provider
4. **Karza → criminal.ts** (Week 3–4) — premium tier prerequisite
5. **DigiLocker → aadhaar.ts** (Week 4) — MoU-bound, longest lead
6. **Refinitiv → sanctions.ts** (Week 6) — optional v1, NRI corridor only

This order minimizes dead time — the platform can launch with Tier 1 day 0, Tier 2 by Week 3, Tier 3 by Week 6.

---

## Compliance notes

- **DPDP Act 2023.** All KYC adapters require explicit user consent before invocation. Consent UI at `apps/web/src/app/(onboarding)/profile/kyc/`.
- **IT Rules 2011.** Sensitive personal data (biometric, financial). Encryption at rest (Postgres + R2 default-on). Access logged via `audit.ts` chained-hash.
- **PMLA.** Sanctions screening is **not** mandated for matrimonial platforms (only FIs). Defer Refinitiv unless NRI corridors expand.
- **eCourts data access.** Aggregator (Karza) holds the legal agreement with court records access; we operate as their downstream consumer with consent.

---

## Cost summary (10k MAU, mixed tier mix)

Assumes 100% Tier 1, 70% Tier 2, 20% Tier 3:

| Provider | Per-verify | Annual cost |
|----------|------------|-------------|
| NSDL PAN | ₹4 | ₹3.4 L (70% × 12k) |
| Razorpay penny-drop | ₹3 | ₹2.5 L |
| AWS Rekognition | ~₹0.10 | ₹14k |
| DigiLocker | free | ₹0 |
| Karza criminal | ₹200 | ₹4.8 L (20% × 12k × ₹200, premium tier) |
| Refinitiv | $0.50 | ₹4 L+ (Tier 1 licence min ~$1500) |
| **Total** | — | **~₹15 L/yr** |

Premium tier (Tier 3) revenue at ₹499/user × 2k users (20%) = ₹10 L → covers Karza + Refinitiv with margin.

---

## Contact for activation

For each adapter, see the matching `docs/PROVIDER-ACTIVATION/*.md` runbook. Each runbook lists exact client documents, switch-on day steps, and rollback procedure.
