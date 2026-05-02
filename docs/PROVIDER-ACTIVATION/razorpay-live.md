# Razorpay LIVE — Activation Runbook

> **Recommended first activation.** Fastest, most demo-visible, unlocks the entire payment surface (bookings, escrow, disputes, refunds, vendor payouts).

---

## What it does in vivahOS

Powers every payment flow in the platform:
- **Bookings.** Customer pays vendor for a service via UPI / cards / wallets / net banking / EMI.
- **Escrow.** Funds held until service delivered. Released on customer confirm or auto-released after grace period.
- **Disputes.** Customer raises issue → escrow holds → admin resolves → refund or release.
- **Refunds.** Initiated from admin or customer dashboard, processed through Razorpay refund API.
- **Subscriptions.** Premium membership recurring billing.
- **Wallet top-up.** Customers add prepaid balance to wallet.
- **Webhooks.** All payment state transitions verified via HMAC-SHA256 signature.

Code reference: `apps/api/src/payments/`, `apps/api/src/lib/razorpay.ts`.

---

## Lead time

**3–5 business days** from agreement signed to LIVE keys in hand.

Breakdown:
- Day 0: Razorpay merchant account creation
- Day 1–2: KYC document upload + GSTIN verification
- Day 2–3: Bank account verification (penny-drop)
- Day 3–5: Razorpay risk team review + activation

---

## What we need from the client

### Documents
- [ ] **Company registration** — CIN certificate (Pvt Ltd or LLP recommended; sole proprietorship works but caps daily limits)
- [ ] **GST registration** — GSTIN certificate. *If not yet registered, get this first — it's the longest sub-dependency.*
- [ ] **PAN** — of company + authorized signatory
- [ ] **Cancelled cheque** — business bank account where settlements land
- [ ] **Authorized signatory Aadhaar** — for video KYC
- [ ] **Director list** — names + DINs

### Account creation
- [ ] Sign up at https://dashboard.razorpay.com/signup using `payments@smartshaadi.co.in` (we'll create this mailbox)
- [ ] Choose business type: "Marketplace" (this enables Route + Fund Account features needed for vendor payouts)
- [ ] Complete KYC wizard end-to-end (do not stop midway — partial submissions reset)

### Settings to configure (after activation email)
- [ ] **Settlement schedule.** Recommend T+2 for first 3 months, then T+1.
- [ ] **Webhook URL.** `https://api.smartshaadi.co.in/api/v1/payments/webhook` — paste exactly. Subscribe to events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`, `payout.processed`, `payout.reversed`, `subscription.charged`, `subscription.cancelled`.
- [ ] **Webhook secret.** Razorpay generates one per webhook. Copy it (32+ chars) and send to Ashwin via encrypted note.

### Hand over to developer
- [ ] **`RAZORPAY_KEY_ID`** (live) — starts with `rzp_live_`
- [ ] **`RAZORPAY_KEY_SECRET`** (live)
- [ ] **`RAZORPAY_WEBHOOK_SECRET`** (live)
- [ ] **Authorized signatory available for the first 24h** in case Razorpay risk team flags the activation

---

## What we configure on switch-on day

```bash
# 1. Set env vars in Railway api service
railway env set RAZORPAY_KEY_ID=rzp_live_xxxxx
railway env set RAZORPAY_KEY_SECRET=xxxxx
railway env set RAZORPAY_WEBHOOK_SECRET=xxxxx

# 2. Verify env validation passes
railway run pnpm --filter api type-check

# 3. Deploy
git push origin main   # CI runs, Railway auto-deploys

# 4. Smoke test on production
curl -X POST https://api.smartshaadi.co.in/api/v1/health
curl -X POST https://api.smartshaadi.co.in/api/v1/ready

# 5. End-to-end test
pnpm test:provider:razorpay -- --live
# Creates a ₹1 booking, captures, refunds, verifies webhook signature, asserts audit log entry

# 6. Monitor
# - Sentry: https://sentry.io/organizations/smart-shaadi/issues/?project=api
# - Razorpay dashboard: https://dashboard.razorpay.com/app/payments
# - Watch for 24h before any production traffic redirect
```

---

## Rollback

If anything fails post-cutover:

```bash
# Option 1: re-enable mock for Razorpay only (other providers unaffected)
railway env set USE_RAZORPAY_MOCK=true
git commit --allow-empty -m "rollback: razorpay mock"
git push

# Option 2: full mock restore (nuclear)
railway env set USE_MOCK_SERVICES=true
```

Past data is unaffected. In-flight transactions (status = `CAPTURED` but escrow not yet released) continue to settle through Razorpay regardless of the mock flag — the flag only controls **new** API calls.

---

## Cost model

| Volume | Razorpay fee | Net to vendor (after our 10% commission) |
|--------|-------------|-------------------------------------------|
| ₹1 cr/yr GMV | ₹2 L (2%) | ₹88 L |
| ₹5 cr/yr GMV | ₹10 L (2%) | ₹4.4 cr |
| ₹10 cr/yr GMV | ₹15 L (1.5%) | ₹8.85 cr |

Razorpay tiers down past ₹5 cr — negotiate at scale. International cards add 1% (rarely used in vivahOS).

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Webhook signature mismatch | Sentry alert from `verifyRazorpaySignature` | Check secret rotation; secret may have been regenerated on Razorpay dashboard |
| Payment captured but webhook never arrives | `payments-reconcile` cron flags after 1h | Manual reconcile via Razorpay dashboard + admin reconciliation page |
| Refund stuck `processing` >24h | Sentry alert | Open Razorpay support ticket; refund will eventually clear or auto-revert |
| Settlement delayed | Razorpay dashboard | Razorpay risk team may have flagged; respond to their email within 4h |

---

## Why this is the right first activation

1. **Fastest.** No DLT registration delay. No MoU draft.
2. **Most demonstrable.** Real money flow is the most credible client-facing proof.
3. **Unlocks revenue.** Until Razorpay is live, the platform earns nothing.
4. **Test mode is identical.** We've run hundreds of test-mode transactions; LIVE behaves the same. Confidence is high.

**Expected outcome.** Within a week of Col. Deepak signing the merchant agreement, real payments flow end-to-end and vivahOS earns its first commission.
