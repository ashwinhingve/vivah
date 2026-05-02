# NSDL PAN Verification — Activation Runbook

---

## What it does in vivahOS

PAN verification (KYC tier 1):
- User submits PAN number + name → NSDL API returns `valid` + matched name + status (active/inactive) → we store status only.

Code reference: `apps/api/src/kyc/pan.ts` (TODO stub at line 37).

---

## Lead time

**2–3 weeks** for NSDL onboarding + IP whitelisting.

Breakdown:
- Week 1: NSDL e-Gov onboarding form + agreement
- Week 2: IP whitelisting (we provide static Railway egress IPs)
- Week 2–3: Sandbox → production credential issuance

---

## What we need from the client

### Pre-application
- [ ] **Entity type:** Pvt Ltd or LLP (NSDL doesn't accept proprietorships)
- [ ] **Business justification document** (we draft):
  - Use case: matrimonial KYC, identity verification
  - Volume estimate: ~5k verifications/month at launch
  - Data flow: PAN entered by user → verified against NSDL → status stored
  - Compliance: Income Tax Act 1961 read with PAN verification rules

### Application
- [ ] Visit https://onlineservices.nsdl.com/paam (Pan Authentication API access)
- [ ] Fill application form
- [ ] Pay one-time onboarding fee (~₹15,000 + GST)
- [ ] Submit:
  - Company PAN
  - GSTIN
  - Authorized signatory PAN + Aadhaar
  - Board resolution authorizing PAN verification API access
  - Letter of authorization

### IP whitelisting
- [ ] We provide Railway egress IPs (these are static):
  - `<railway-static-ip-1>`
  - `<railway-static-ip-2>`
- [ ] Client submits to NSDL via dashboard
- [ ] Wait 2–3 days for whitelist activation

### Hand over to developer
- [ ] **`NSDL_USER_ID`**
- [ ] **`NSDL_API_KEY`**
- [ ] **`NSDL_ENDPOINT`** (sandbox first, then prod)
- [ ] Per-verify pricing tier confirmed

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set NSDL_USER_ID=xxxxx
railway env set NSDL_API_KEY=xxxxx
railway env set NSDL_ENDPOINT=https://api.nsdl.com/...

# 2. Implement adapter
#    apps/api/src/kyc/pan.ts — replace mock; estimated 0.5 day

# 3. Flip mock + deploy + smoke
railway env set USE_NSDL_MOCK=false
git push origin main
pnpm test:provider:nsdl -- --live
# Verifies a developer's PAN; asserts response shape; asserts only status stored
```

---

## Rollback

```bash
railway env set USE_NSDL_MOCK=true
```

---

## Cost model

| Tier | Per-verify cost |
|------|-----------------|
| 0–10k/month | ₹4 |
| 10k–50k | ₹3.50 |
| 50k+ | ₹3 |

Onboarding fee ₹15,000 is one-time. At 10k MAU with 70% verifying: ~₹28k/mo.

---

## Critical security note

We store: PAN status (`valid`/`invalid`), verified-at timestamp, name-match boolean. We **never** store the raw PAN number after verification — only the last 4 digits for user UX. Same pattern as Aadhaar.

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| `Invalid IP` error | Sentry | Railway IP changed; reapply for whitelist (rare) |
| `Auth failed` | Sentry | API key rotated; check NSDL dashboard |
| Name mismatch (high false-positive rate) | User complaints | Show user the matched name; allow correction + re-submit |
| Service maintenance window | NSDL emails advance notice | Queue verifications; retry post-window |

---

## Alternative — Karza or AuthBridge

Both aggregate NSDL + provide a cleaner API. Trade-off: ₹6–8 per verify vs ₹4 direct, but no NSDL onboarding. Recommended only if NSDL direct onboarding stalls past 4 weeks.
