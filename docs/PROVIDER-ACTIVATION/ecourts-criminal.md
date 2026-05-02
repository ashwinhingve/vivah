# Criminal Record Check (Karza / AuthBridge) — Activation Runbook

> **Vendor selection required.** eCourts API is not directly available; we use an aggregator.

---

## What it does in vivahOS

Background verification (KYC tier 3, optional premium):
- User opts in to background check → name + DOB + father's name → aggregator queries court records (criminal cases, civil suits) across India → returns `clean` / `flagged` with case summary if any
- Premium feature for safety-conscious users

Code reference: `apps/api/src/kyc/criminal.ts` (TODO at line 27).

---

## Lead time

**1–2 weeks** depending on vendor.

| Vendor | Lead | Pros | Cons |
|--------|------|------|------|
| **Karza** (recommended) | 1–2 weeks | Cleanest API, sandbox in 3 days | Per-check ₹150–250 |
| **AuthBridge** | 2–3 weeks | Mature, used by major BFSI | Slower onboarding |
| **IDfy** | 1 week | Modern API, great docs | Smaller eCourts coverage |

---

## What we need from the client

### Vendor selection
- [ ] Decide: Karza, AuthBridge, or IDfy. **Recommendation: Karza.**
- [ ] Reach out — sales rep contacts:
  - Karza: https://karza.in/contact
  - AuthBridge: https://authbridge.com/contact
  - IDfy: https://idfy.com/contact

### Contract
- [ ] **Volume commitment.** Most vendors require minimum monthly volume; negotiate "no-minimum" pricing for first 6 months.
- [ ] **Annual contract or pay-as-you-go.** PAYG is more flexible at low volume.
- [ ] Consent flow approval — vendor reviews our user-facing consent text (we provide; client confirms with legal)

### Hand over to developer
- [ ] **`KARZA_API_KEY`** (or chosen vendor)
- [ ] **`KARZA_ENDPOINT`** (sandbox + prod)
- [ ] Per-check cost confirmed
- [ ] Vendor-side webhook for async results (criminal checks take 5–60 min, not synchronous)

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set KARZA_API_KEY=xxxxx
railway env set KARZA_ENDPOINT=https://api.karza.in/...

# 2. Implement adapter
#    apps/api/src/kyc/criminal.ts — replace mock; estimated 1 day
#    Add async result handler: apps/api/src/kyc/criminalWebhook.ts (new)

# 3. Flip mock + deploy
railway env set USE_CRIMINAL_MOCK=false
git push origin main

# 4. Smoke
pnpm test:provider:karza -- --live
# Submit a test case (vendor provides); verify async result lands within SLA
```

---

## Rollback

```bash
railway env set USE_CRIMINAL_MOCK=true
# Optional KYC tier — premium users see "temporarily unavailable"
```

---

## Cost model

| Vendor | Per-check | Min/month |
|--------|-----------|-----------|
| Karza | ₹200 | none (after 6mo, ₹10k min) |
| AuthBridge | ₹250 | ₹25k |
| IDfy | ₹180 | ₹15k |

We charge users ₹499 for premium KYC tier (includes criminal + sanctions). Margin: ₹250–300 per check.

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Async result never arrives (>2h) | Cron poller | Retry; alert vendor if 6h+ |
| False match (common name) | User dispute | Manual review with admin; refund check fee on confirmed FP |
| eCourts portal down (vendor's upstream) | Vendor email | Pause new checks; auto-resume |
| Consent challenged by user | Audit log | Show original consent + signed timestamp |

---

## Critical compliance note

Criminal records access requires **explicit informed consent** from the user under the Information Technology Act 2000 + DPDP 2023. Our consent flow:
1. User opts in to "Premium Safety Verification"
2. Reads + ticks 3 separate consent boxes (data scope, sharing, retention)
3. Signs (typed full name)
4. Audit log entry with chained-hash

This is enforced by the UI at `apps/web/src/app/(onboarding)/profile/kyc` and the audit log infrastructure already in place.

---

## Why we don't go direct to eCourts

eCourts portal exists (https://ecourts.gov.in) but does not offer a public API. Aggregators scrape + structure the data with vendor agreements. Going direct would require building scrapers per state — not viable.
