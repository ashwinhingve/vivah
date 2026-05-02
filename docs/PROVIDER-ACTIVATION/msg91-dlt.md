# MSG91 + DLT — Activation Runbook

> **Critical for OTP login.** No DLT, no SMS, no signup.

---

## What it does in vivahOS

- **Phone OTP** — primary signup + login flow. Customer enters phone → receives 6-digit OTP → verifies. Code: `apps/api/src/auth/config.ts:119`, `apps/api/src/auth/securityRouter.ts:283`.
- **Transactional SMS** — booking confirmations, dispute updates, payment receipts, vendor accept/reject notifications, RSVP reminders.
- **Wedding invitation blasts** — bulk SMS to guest list.

Code reference: `apps/api/src/notifications/providers/msg91.ts`, `apps/api/src/lib/msg91.ts`.

---

## Lead time

**~2 weeks** dominated by DLT (Distributed Ledger Technology) registration. India mandates DLT for all transactional/promotional SMS — non-DLT senders are blocked at telco level.

Breakdown:
- Day 0–2: MSG91 account + sender ID request
- Day 2–10: DLT registration on Jio + Airtel + Vi + BSNL portals (each ₹5,900, refundable security deposit)
- Day 10–14: Template approvals (each template needs separate approval, 24–72h per template)

---

## What we need from the client

### DLT registration (mandatory before any SMS)
- [ ] **Principal Entity (PE) registration** on each telco's DLT portal:
  - Jio: https://trueconnect.jio.com
  - Airtel: https://www.airtel.in/business/commerce/dlt
  - Vi: https://www.vilpower.in
  - BSNL: https://www.ucc.bsnl.co.in
- [ ] PE ID (one per telco — keep all four; Jio's is the most-used)
- [ ] Pay ₹5,900 × 4 = ₹23,600 (refundable security deposit)
- [ ] **Required docs:** GSTIN, PAN, CIN, authorized signatory's Aadhaar+PAN, board resolution, letter of authorization

### Header / Sender ID
- [ ] Choose 6-character sender ID. **Recommended: `SHADII`** (registered as transactional). Check availability on each telco portal.
- [ ] Register the header on all 4 portals
- [ ] Header type: **Transactional** (we don't send promotional SMS in v1)

### Templates (we provide the text; client submits for approval)
- [ ] OTP template — `Your Smart Shaadi verification code is {#var#}. Valid for 10 minutes. Do not share.`
- [ ] Booking confirmation — `Your booking with {#var#} is confirmed for {#var#}. Booking ID: {#var#}. Track at smartshaadi.co.in`
- [ ] Payment receipt — `₹{#var#} received for booking {#var#}. Receipt: {#var#}. Smart Shaadi`
- [ ] Dispute update — `Dispute on booking {#var#} updated: {#var#}. Smart Shaadi`
- [ ] Match request — `New match request from {#var#}. Open Smart Shaadi to respond.`
- [ ] RSVP reminder — `Reminder: please RSVP to {#var#}'s wedding by {#var#}. Smart Shaadi`

### MSG91 account
- [ ] Sign up at https://msg91.com using `messaging@smartshaadi.co.in`
- [ ] Link DLT credentials in MSG91 dashboard (paste PE IDs + header from above)
- [ ] Submit each template via MSG91 dashboard (faster approval than direct telco submission)
- [ ] Once approved, MSG91 issues a Template ID per template

### Hand over to developer
- [ ] **`MSG91_API_KEY`** (auth key from MSG91 dashboard)
- [ ] **`MSG91_SENDER_ID`** = `SHADII`
- [ ] **Template IDs** for each of the 6 templates above (we'll add them to env or a config file)
- [ ] Confirmation that all 4 telco PE registrations are active

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set MSG91_API_KEY=xxxxx
railway env set MSG91_SENDER_ID=SHADII
railway env set MSG91_TEMPLATE_OTP=xxxxx
railway env set MSG91_TEMPLATE_BOOKING_CONFIRM=xxxxx
railway env set MSG91_TEMPLATE_PAYMENT_RECEIPT=xxxxx
railway env set MSG91_TEMPLATE_DISPUTE_UPDATE=xxxxx
railway env set MSG91_TEMPLATE_MATCH_REQUEST=xxxxx
railway env set MSG91_TEMPLATE_RSVP_REMINDER=xxxxx

# 2. Flip mock
railway env set USE_MSG91_MOCK=false

# 3. Deploy + smoke
git push origin main
pnpm test:provider:msg91 -- --live
# Sends test OTP to a developer's phone, asserts delivery within 30s

# 4. Monitor first 24h
# Watch MSG91 dashboard for delivery rate
# DLT-enabled SMS in India typically deliver in <5s, 99%+ rate
```

---

## Rollback

```bash
railway env set USE_MSG91_MOCK=true
# OTPs print to logs (dev mode behavior). Existing sessions unaffected.
```

---

## Cost model

| Component | One-time | Recurring |
|-----------|----------|-----------|
| DLT registration (4 telcos) | ₹23,600 | refundable on de-registration |
| Template approval | free | — |
| OTP SMS | — | ₹0.18 per SMS |
| Transactional SMS | — | ₹0.20 per SMS |

At 10k MAU with ~3 SMS/MAU/month: ~₹6k/mo. At 100k MAU: ~₹60k/mo.

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| OTP not delivered | User complains; MSG91 dashboard shows `failed` | Check DLT header validity; some telcos randomly suspend headers — re-register |
| Template rejected | MSG91 dashboard | Edit text to be more transactional, less marketing-flavored, resubmit |
| `Invalid template_id` error | Sentry | Template was approved on Jio but not Airtel; user's number is on Airtel network; resubmit on missing telcos |
| DLT compliance audit | TRAI/telco notice | Have all template approvals + PE IDs ready |

---

## Critical gotcha — DLT scrubbing

Indian telcos **scrub** SMS in real-time. If our text doesn't match the approved template **exactly** (including punctuation), the SMS is silently dropped. Variables (`{#var#}`) are dynamic; everything else is literal. Test every template change with a real send before deploying.

---

## Why this is a 2-week activation

The bottleneck is the four telco PE registrations + per-template approvals. Each telco's portal is independently slow and bureaucratic. Submitting all four PE registrations on Day 0 + all 6 templates on Day 2 (in parallel) compresses to ~10 working days. Linear submission stretches to 4+ weeks.
