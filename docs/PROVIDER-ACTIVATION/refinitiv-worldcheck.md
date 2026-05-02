# Refinitiv WorldCheck One — Activation Runbook

> **Optional for v1.** Sanctions screening is required for financial institutions; matrimonial platforms have weaker legal mandate. Activate if expanding to NRI corridors (US, UK, EU jurisdictions enforce screening even for non-financial platforms when payments cross borders).

---

## What it does in vivahOS

Sanctions + PEP (Politically Exposed Person) + adverse media screening:
- User completes KYC → name + DOB + nationality screened against WorldCheck One database (~5M records: OFAC, EU, UN, Interpol watchlists, PEPs, sanctioned individuals)
- Matches flagged for admin review; non-matches auto-cleared
- Result stored as: `kyc_sanctions_status: clean | review | blocked`

Code reference: `apps/api/src/kyc/sanctions.ts` (TODO stub at line 29).

---

## Lead time

**4–6 weeks** dominated by sales cycle + licence negotiation.

Breakdown:
- Week 1: Demo + quote request
- Week 2–3: Quote received, contract negotiation
- Week 4–5: Contract signed, API credentials issued
- Week 6: Sandbox testing → production

---

## What we need from the client

### Sales engagement
- [ ] **Initial inquiry** at https://www.refinitiv.com/en/products/world-check-kyc-screening (Refinitiv is a London Stock Exchange Group company)
- [ ] **Volume estimate** — start with 10k screenings/month tier
- [ ] **Use case** — KYC for matrimonial platform; primary risk = financial fraud, identity fraud
- [ ] **Schedule sales demo** (60 min)

### Contract
- [ ] **Annual licence minimum: ~$1,500/year** (Tier 1, 10k screenings/yr)
- [ ] Contract terms reviewed by client's legal counsel
- [ ] Authorized signatory signs
- [ ] First annual fee paid (typically requires PO + 30-day terms)

### Hand over to developer
- [ ] **`REFINITIV_API_KEY`**
- [ ] **`REFINITIV_API_SECRET`**
- [ ] **`REFINITIV_ENDPOINT`** (sandbox first)
- [ ] Confirmed quota / month

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set REFINITIV_API_KEY=xxxxx
railway env set REFINITIV_API_SECRET=xxxxx
railway env set REFINITIV_ENDPOINT=https://api.worldcheck.com/...

# 2. Implement adapter
#    apps/api/src/kyc/sanctions.ts — replace mock; estimated 1 day
#    Sanctions matches go to admin review queue (apps/web/src/app/(app)/admin/kyc)

# 3. Flip mock + deploy
railway env set USE_REFINITIV_MOCK=false
git push origin main
pnpm test:provider:refinitiv -- --live
# Screens a known sanctioned name (Refinitiv provides test data); asserts match flagged
```

---

## Rollback

```bash
railway env set USE_REFINITIV_MOCK=true
# All users auto-clear; no impact on existing approvals
```

---

## Cost model

| Tier | Annual licence | Per-screening (over included) |
|------|---------------|-------------------------------|
| Tier 1 (10k/yr) | $1,500 | $0.50 |
| Tier 2 (50k/yr) | $5,000 | $0.30 |
| Tier 3 (250k/yr) | $20,000 | $0.10 |

Cheapest non-Refinitiv option: ComplyAdvantage (~$3,000/yr min, similar coverage).

---

## Critical security note

False-positive rate in sanctions screening is high (typical name "Mohammed" matches 100+ records). The admin review queue is essential — never auto-block on a name match. The flow is:
1. Screen → match → flag → admin review
2. Admin reviews additional context (DOB, nationality, address) → confirms or clears
3. Only confirmed matches → block + audit log entry

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| API rate limit (1 req/sec default) | Sentry | Throttle in queue; not user-facing |
| Daily quota exceeded | Refinitiv dashboard | Upgrade tier or queue for next day |
| Sandbox credentials still in use after go-live | False match data appears | Verify endpoint URL — sandbox vs prod differ by domain |

---

## Why this is optional for v1

vivahOS launches Indian-domestic. Indian regulator does not mandate sanctions screening for matrimonial platforms (only for FIs under PMLA). Add this when expanding to NRI corridors or when client receives a banking partner request.
