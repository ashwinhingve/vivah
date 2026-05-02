# Provider Activation Kit

> **Purpose.** vivahOS is built and tested. Going live needs agreements signed with each external provider. This kit is the single source of truth for what's needed from the client side and what we configure on switch-on day.
>
> **Owner:** Ashwin Hingve (developer) · **Client:** Col. Deepak
> **Status:** Demo-ready (mocks ON for all providers except Razorpay test-mode)
> **Last updated:** 2026-05-02

---

## How this kit works

Every external provider has its own Markdown file in this folder following an identical template:

```
# <Provider> — Activation Runbook
## What it does in vivahOS
## Lead time
## What we need from the client          ← actionable client checklist
## What we configure on switch-on day    ← developer steps
## Rollback
## Cost model
```

When the client signs an agreement, we open the matching file, work through the client-input checklist, then run the developer steps. The provider goes live in hours, not weeks (lead time is purely the client-side onboarding wait).

---

## Activation timeline matrix

Sorted by speed-to-live once agreement is signed.

| # | Provider | Lead time | Client effort | Critical path | Cost @ 10k MAU |
|---|----------|-----------|---------------|---------------|----------------|
| 1 | [Daily.co paid](daily-co-paid.md) | **1 day** | Plan upgrade | Video calls, recordings | ₹8k/mo |
| 2 | [Firebase FCM](firebase-fcm.md) | **1 day** | Service account JSON | Push notifications | Free |
| 3 | [AWS Rekognition](aws-rekognition.md) | **1 day** | IAM keys + region | KYC face match | ₹2k/mo |
| 4 | [Razorpay LIVE](razorpay-live.md) | **3–5 days** | Merchant KYC, GST, bank acct | All payments | 2% of GMV |
| 5 | [AWS SES prod](aws-ses-prod.md) | **1–2 weeks** | Domain DKIM/SPF | Transactional email | ₹500/mo |
| 6 | [eCourts criminal](ecourts-criminal.md) | **1–2 weeks** | Vendor agreement (Karza) | KYC criminal check | ₹15k/mo |
| 7 | [MSG91 DLT](msg91-dlt.md) | **2 weeks** | DLT principal entity reg | OTP, transactional SMS | ₹0.18/SMS |
| 8 | [NSDL PAN](nsdl-pan.md) | **2–3 weeks** | NSDL onboarding form | KYC PAN verify | ₹4/verify |
| 9 | [DigiLocker](digilocker.md) | **4 weeks** | MoU + RSA public key | KYC Aadhaar | Free |
| 10 | [Refinitiv WorldCheck](refinitiv-worldcheck.md) | **4–6 weeks** | Licence + API config | KYC sanctions screening | $1.5k/yr min |
| 11 | [Razorpay Fund Account](razorpay-fund-account.md) | **bundled with Razorpay LIVE** | (same merchant agreement) | Vendor payouts | included |

**Recommendation.** Start Razorpay LIVE first — it's the most user-visible (real payment flow) and fastest to activate. KYC providers (DigiLocker, NSDL, Refinitiv) can run in parallel since their lead times are dominated by external onboarding.

---

## What can demo without any provider activation

Everything. The system runs end-to-end on staging with `USE_MOCK_SERVICES=true` for all providers except Razorpay (which uses real test-mode keys for the dispute/escrow demo). The client meeting demonstrates the full feature surface; activation is the next phase.

---

## Switch-on day — generic procedure

Same five steps for every provider:

1. **Verify client inputs.** Tick every box in the "What we need from the client" section of the provider's runbook.
2. **Set env vars.** Add the provider's keys to Railway (api) and Vercel (web). Never commit to git.
3. **Flip mock flag.** Set `USE_<PROVIDER>_MOCK=false` (or remove `USE_MOCK_SERVICES=true` once all providers are live).
4. **Run smoke.** `pnpm test:provider:<name> -- --live`. Must be green.
5. **Monitor.** Watch Sentry + PostHog + Grafana for 24h. Roll back on anomaly.

Rollback is always: flip the flag back, redeploy. Past data is unaffected because the mock fallback path is symmetric.

---

## Files in this folder

| File | Provider | What it gates |
|------|----------|---------------|
| `razorpay-live.md` | Razorpay LIVE | All payment captures, refunds, escrow, disputes |
| `razorpay-fund-account.md` | Razorpay Fund Account | Vendor payouts (penny-drop verification) |
| `msg91-dlt.md` | MSG91 DLT | Phone OTP, transactional SMS |
| `aws-ses-prod.md` | AWS SES | Transactional email (invitations, receipts, alerts) |
| `digilocker.md` | DigiLocker | Aadhaar verification |
| `nsdl-pan.md` | NSDL | PAN verification |
| `aws-rekognition.md` | AWS Rekognition | Face match + liveness in KYC |
| `ecourts-criminal.md` | Karza or AuthBridge | Criminal record check |
| `refinitiv-worldcheck.md` | Refinitiv | Sanctions screening |
| `daily-co-paid.md` | Daily.co | Video call rooms + recording |
| `firebase-fcm.md` | Firebase Cloud Messaging | Push notifications |

---

## What we still need from the client (consolidated)

Single client action list, pulled from all 11 runbooks:

### Identity & legal
- [ ] Company registration certificate (CIN)
- [ ] GST registration certificate (GSTIN)
- [ ] PAN of authorized signatory
- [ ] Cancelled cheque from business bank account
- [ ] Authorized signatory's Aadhaar
- [ ] Letter of authorization for Ashwin Hingve as technical contact

### Razorpay
- [ ] Razorpay merchant account created (we provide signup link)
- [ ] KYC documents uploaded
- [ ] Bank account linked + verified
- [ ] Webhook URL approved (`https://api.smartshaadi.co.in/api/v1/payments/webhook`)
- [ ] Live API keys copied to Railway by Ashwin

### MSG91 + DLT
- [ ] DLT principal entity registration on Jio/Airtel/Vi/BSNL portals (₹5,900 each, refundable)
- [ ] MSG91 account created
- [ ] Sender ID requested ("SHADII" recommended)
- [ ] OTP + 5 transactional templates approved (templates ready in `msg91-dlt.md`)

### AWS (SES, Rekognition)
- [ ] AWS account ready (or use developer's; client owns billing)
- [ ] SES sandbox lift requested
- [ ] Domain `smartshaadi.co.in` DKIM + SPF + DMARC published

### KYC providers
- [ ] DigiLocker partner application submitted (form attached)
- [ ] NSDL PAN verification onboarding form filled
- [ ] Karza or AuthBridge contract for criminal check signed
- [ ] Refinitiv WorldCheck One quote received and signed

### Other
- [ ] Daily.co paid plan upgrade ($99/mo or higher)
- [ ] Firebase project created; service account JSON shared securely
- [ ] DNS for `api.smartshaadi.co.in` + `app.smartshaadi.co.in` pointed at Railway/Vercel

---

## Cost summary at expected first-year volume

Assuming 10k MAU, ₹2 cr GMV/year:

| Category | Monthly | Annual | Notes |
|----------|---------|--------|-------|
| Razorpay (2% of GMV) | ~₹33k | ₹4 L | Net of refunds |
| MSG91 SMS (2 OTPs/MAU + 5 txns) | ~₹12k | ₹1.4 L | DLT registration ₹24k one-time |
| Daily.co | ₹8k | ₹1 L | Scale plan |
| KYC stack (~70% of MAU verify) | ~₹50k | ₹6 L | NSDL + DigiLocker + Rekognition + criminal + Refinitiv |
| AWS SES + Rekognition | ₹3k | ₹35k | |
| **Total external providers** | **~₹1.06 L** | **~₹13 L** | Excludes Refinitiv minimum + DLT one-time |

Hosting (Railway + Vercel + Supabase + MongoDB Atlas + Cloudflare R2 + Redis) is separate, ~₹50k/mo at this scale.

---

## Security note for client

No provider key is ever committed to git. All keys live in:
- **Railway** (api service env vars)
- **Vercel** (web env vars, only `NEXT_PUBLIC_*` exposed to client bundle)

The developer (Ashwin) never sees raw keys after the initial set — they're entered directly into the dashboards. Rotation is a one-button action on each provider's dashboard followed by Railway/Vercel env update.

---

## Next step for Col. Deepak

Pick one provider to start with. **Recommended: Razorpay LIVE.** It's user-visible, fastest to activate, and unlocks the most demonstrable feature (real payments end-to-end). Once it's live in production, every subsequent provider follows the same kit.

Open `razorpay-live.md` for the exact step-by-step.
