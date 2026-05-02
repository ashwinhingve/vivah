# DigiLocker — Activation Runbook

> **The longest lead time** of any provider — start this early.

---

## What it does in vivahOS

Aadhaar verification (KYC tier 2):
- User initiates Aadhaar verification → redirects to DigiLocker → user authorizes → DigiLocker returns signed Aadhaar XML → we verify signature → store **verification status only** (CLAUDE.md security rule: no raw Aadhaar storage).

Code reference: `apps/api/src/kyc/aadhaar.ts` (currently TODO stub at lines 22, 35).

---

## Lead time

**~4 weeks** dominated by Meri Pehchaan partner application + MoU.

Breakdown:
- Week 1: Partner application submitted, RSA public key generated
- Week 2: Government review (Ministry of Electronics & IT)
- Week 3: MoU draft + legal review by client's counsel
- Week 4: MoU signed + sandbox credentials issued, production credentials follow after sandbox testing

---

## What we need from the client

### Pre-application
- [ ] **Company registration.** Pvt Ltd or LLP only (sole proprietorship not eligible)
- [ ] **Authorized signatory** identified (name + designation in board resolution)
- [ ] **Use case document** — we draft; client reviews:
  - Purpose: KYC for matrimonial platform users
  - Volume: ~70% of MAU at scale
  - Data handling: verification status only; no raw Aadhaar persisted
  - Storage: PostgreSQL with encryption at rest
  - Retention: as long as user account is active; deleted on account deletion
- [ ] **Privacy policy** at `https://smartshaadi.co.in/privacy` updated to mention DigiLocker

### Application
- [ ] Apply at https://partners.digilocker.gov.in
- [ ] Generate **RSA 2048 key pair** (we generate; client securely stores private key)
- [ ] Upload public key + use case + company docs
- [ ] Pay registration fee (currently free for non-commercial; review at submission time)

### MoU (legal step — slowest)
- [ ] Government emails draft MoU (~2 weeks after application)
- [ ] Client's legal counsel reviews
- [ ] Authorized signatory signs (digital or wet)
- [ ] Government counter-signs
- [ ] Sandbox credentials issued

### Sandbox → Production
- [ ] Run 100 sandbox transactions
- [ ] Submit transition request
- [ ] Government approves production credentials (~1 week)

### Hand over to developer
- [ ] **`DIGILOCKER_CLIENT_ID`**
- [ ] **`DIGILOCKER_CLIENT_SECRET`**
- [ ] **Private RSA key** (PEM format, 2048-bit) — stored as Railway secret file
- [ ] **Redirect URI registered** — `https://api.smartshaadi.co.in/api/v1/kyc/aadhaar/callback`

---

## What we configure on switch-on day

```bash
# 1. Env vars + secret file
railway env set DIGILOCKER_CLIENT_ID=xxxxx
railway env set DIGILOCKER_CLIENT_SECRET=xxxxx
# Private key as a multiline secret:
railway env set DIGILOCKER_PRIVATE_KEY="$(cat private.pem)"

# 2. Implement the adapter (currently TODO stub)
#    apps/api/src/kyc/aadhaar.ts — replace mock with real DigiLocker OAuth2 flow
#    Estimated effort: 1 day (well-documented protocol)

# 3. Flip mock
railway env set USE_DIGILOCKER_MOCK=false

# 4. Deploy + smoke
git push origin main
pnpm test:provider:digilocker -- --sandbox  # while still in sandbox
# Run 100 verifications; assert XML signature validation; assert no raw Aadhaar persisted

# 5. Production smoke (after government promotes us)
pnpm test:provider:digilocker -- --live
```

---

## Rollback

```bash
railway env set USE_DIGILOCKER_MOCK=true
# KYC tier 2 users see "verification temporarily unavailable" UI
# Existing verified statuses unaffected
```

---

## Cost model

DigiLocker is free for verified partners. Indirect costs:
- RSA key management
- Audit log retention (DigiLocker requires we retain access logs for 7 years)
- Annual compliance review (self-attested)

---

## Critical security note

vivahOS **never persists raw Aadhaar numbers** (CLAUDE.md security rule + DigiLocker MoU clause). The flow stores only:
- `kyc_aadhaar_verified: boolean`
- `kyc_aadhaar_verified_at: timestamp`
- `kyc_aadhaar_last4: string` (last 4 digits, for user UX confirmation)
- `kyc_aadhaar_xml_hash: sha256` (proof we verified, without storing the original)

The signed XML response from DigiLocker is verified, hashed, then discarded. This is enforceable by code review + ESLint rule `no-raw-aadhaar` (custom).

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Government MoU stuck | No reply >3 weeks | Escalate to MeitY contact; have client's authorized signatory call |
| Signature verification fails | Sentry alert | Likely public-key mismatch; re-register on DigiLocker dashboard |
| User authorizes but XML missing | DigiLocker dashboard | Check redirect URI exact match; sandbox vs prod URI mismatch is common |
| Rate limit exceeded | DigiLocker returns 429 | Default limit is generous (1000/hr); increase only if >2x growth |

---

## Why start this in week 1

If we wait for Razorpay LIVE first (~Week 2) and **then** start DigiLocker, the platform is launched but KYC tier 2 is mocked. Starting DigiLocker on Day 1 of provider activation makes it ready right when launch traffic ramps.
