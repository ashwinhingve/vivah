# Razorpay Fund Account (Vendor Payouts) — Activation Runbook

> **Bundled with Razorpay LIVE.** Same merchant agreement; activated separately via RazorpayX.

---

## What it does in vivahOS

Vendor payouts:
- Vendor onboards → adds bank account → ₹1 penny-drop verifies account ownership → fund account ID stored
- After service delivery + escrow release → automatic payout to vendor's verified bank account
- Settlement T+1 (next business day)

Code reference: `apps/api/src/payments/payouts.ts` (currently untracked); `apps/api/src/admin/vendors.router.ts:26` has TODO comment.

---

## Lead time

**1–2 days** after Razorpay LIVE is active. Same merchant account; just enable RazorpayX (the payouts product) in dashboard.

---

## What we need from the client

### Pre-requisites
- [ ] **Razorpay LIVE active** (see `razorpay-live.md`)
- [ ] **Marketplace account type** confirmed (chosen during initial Razorpay signup)

### RazorpayX activation
- [ ] In Razorpay dashboard → enable RazorpayX
- [ ] Pre-fund the payout account (₹1 L initial, top up as needed)
- [ ] Approve "Auto Payout" feature

### Compliance
- [ ] **Vendor agreement template** — we provide; client's legal reviews
  - Includes: TDS deduction (1% Section 194O), GST handling, refund policy, dispute resolution
- [ ] **TDS / GST handling** — client's CA confirms approach
  - We deduct 1% TDS on vendor payouts >₹2.5L/year (under Sec 194O)
  - We collect GST from customer; vendor invoices us for net-of-GST amount
  - Form 26AS filings quarterly

### Hand over to developer
- [ ] **`RAZORPAY_X_ACCOUNT_NUMBER`** (the marketplace's RazorpayX virtual account)
- [ ] **Webhook events** added to existing webhook URL: `payout.processed`, `payout.failed`, `payout.reversed`
- [ ] Pre-funded balance confirmed

---

## What we configure on switch-on day

```bash
# 1. Env vars (added to existing Razorpay set)
railway env set RAZORPAY_X_ACCOUNT_NUMBER=xxxxx

# 2. Flip mock
railway env set USE_PAYOUT_MOCK=false

# 3. Deploy + implement adapters
#    apps/api/src/payments/payouts.ts — implement penny-drop + payout
#    Estimated 1 day

# 4. Smoke
pnpm test:provider:razorpay-x -- --live
# Penny-drop verifies a developer's bank account; ₹1 transferred and reversed in 5 min
```

---

## Rollback

```bash
railway env set USE_PAYOUT_MOCK=true
# Vendors see "payout pending" — manually clear via admin panel
```

---

## Cost model

| Operation | Cost |
|-----------|------|
| Penny-drop (account verification) | ₹1 (refunded) + ₹3 fee |
| IMPS payout | ₹5 per payout |
| NEFT payout | ₹5 per payout |
| RTGS payout | ₹15 per payout |
| Settlement to RazorpayX virtual account | included in Razorpay LIVE 2% |

At 100 vendor payouts/day @ ₹5 each: ₹15k/mo. Negligible vs commission revenue.

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Penny-drop fails (wrong account) | Sentry | Vendor notified; resubmit details |
| Payout reversed (closed account) | Webhook | Vendor notified; remove account from active list |
| RazorpayX balance insufficient | Razorpay error | Auto-top-up trigger; alert admin |
| Bank holiday / cutoff missed | Razorpay queues automatically | Settles next business day; not an error |

---

## Critical compliance note

Vendor payouts are taxable events:
1. **Customer pays** ₹X (incl. GST) → our Razorpay LIVE
2. **Escrow holds** until service delivered
3. **On release:** we deduct platform commission (10%) + GST on commission (18% of commission)
4. **TDS deducted** at 1% on vendor's gross (over ₹2.5L/year threshold per vendor)
5. **Vendor receives** ₹X − commission − TDS via RazorpayX payout
6. **Audit log entry** with chained-hash recording exact amounts
7. **Form 26AS filing** quarterly to Income Tax dept

The dispute path holds escrow; nothing is paid out until resolved. Refund path returns customer money + reverses our commission.

---

## Why this is fast

Same merchant relationship; RazorpayX is a feature toggle. The only gate is the legal review of vendor agreement, which the client's counsel can do in parallel with Razorpay LIVE activation.
