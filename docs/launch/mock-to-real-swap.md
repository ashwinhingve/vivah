# Mock → Real Credential Swap Runbook

> **Authored from a verified read of the code** (`apps/api/src/lib/env.ts`,
> `lib/razorpay.ts`, `payments/webhook.ts`, `store/webhook.ts`, `kyc/router.ts`,
> the five Rule‑11 Mongo services, `storage/service.ts`). Where this runbook differs
> from earlier assumptions, see the **Drift log** at the bottom.
>
> **Golden rule:** flip `USE_MOCK_SERVICES=false` **last**. Bring each backend live
> individually first (via its `*_LIVE` override) and verify, so a bad credential is
> isolated to one provider instead of taking the whole API down.

---

## Flag matrix (`apps/api/src/lib/env.ts`)

All booleans, default `false`. Parsed + validated at process boot.

| Flag | Effect |
|---|---|
| `USE_MOCK_SERVICES` | Master toggle — when `true`, all external integrations are stubbed. |
| `MONGO_LIVE` | Override: use real MongoDB even while `USE_MOCK_SERVICES=true`. |
| `R2_LIVE` | Override: use real Cloudflare R2 even while `USE_MOCK_SERVICES=true`. |
| `KYC_LIVE` | **Inverted** override: KYC (DigiLocker/Aadhaar/PAN/bank/criminal/faceMatch/liveness) stays **mocked** until this is `true`, even after `USE_MOCK_SERVICES=false`. Keeps DigiLocker stubbed through the master flip. |
| `ALLOW_MOCK_SERVICES_IN_PROD` | Escape hatch: bypass the `NODE_ENV=production && USE_MOCK_SERVICES=true` boot guard. Do **not** set in a real launch. |
| `MOCK_OTP_VALUE` | **Required** whenever `USE_MOCK_SERVICES=true` (no default — old `123456` backdoor removed). |

**Derived gates (single source of truth — `deriveMockFlags`):**
- `shouldUseMockMongo = USE_MOCK_SERVICES && !MONGO_LIVE`
- `shouldUseMockR2    = USE_MOCK_SERVICES && !R2_LIVE`
- `shouldUseMockKyc   = USE_MOCK_SERVICES || !KYC_LIVE` *(inverted — real KYC only when `KYC_LIVE=true` AND master off)*

**Boot guards (process exits if violated):**
- `NODE_ENV=production && USE_MOCK_SERVICES=true && !ALLOW_MOCK_SERVICES_IN_PROD`
- `USE_MOCK_SERVICES=true && !MOCK_OTP_VALUE`

> ⚠️ **There is no `RAZORPAY_LIVE` flag.** Razorpay and MSG91 have no granular override —
> they go live only when `USE_MOCK_SERVICES=false`, and flip together at the final step.
> **KYC is the exception:** it has its own `KYC_LIVE` flag (inverted semantics) so DigiLocker
> stays mocked when the master flips, until DigiLocker registration lands. So the
> incremental-cutover stages apply to **Mongo, R2, and KYC**; only payments/SMS flip together
> at step 6. Plan the cutover window accordingly.

---

## Swap steps (dependency order)

Each step: set the env var on **Railway (API)** + **Vercel (web)** as noted, redeploy,
run the verify, and keep the rollback one-liner ready.

### 1. MongoDB
- Set real `MONGODB_URI` (Railway). Set `MONGO_LIVE=true`.
- `shouldUseMockMongo` → `false`: the five Rule‑11 services (`content`, `horoscope`,
  `preferences`, `safety`, `profiles/service`) read **and** write real Mongo.
- **Verify:** save a profile section, then re-fetch it in a new request — it must persist
  (not vanish, not return stale mock JSON). `GET /health` stays 200.
- **Rollback:** unset `MONGO_LIVE` (back to mockStore).

### 2. Cloudflare R2
- Set real `CLOUDFLARE_R2_*` (Railway). Set `R2_LIVE=true`.
- `shouldUseMockR2` → `false`: presigned GET/PUT URLs point at real R2.
- **Verify:** request an upload URL, PUT a file, then GET it back via the photo URL.
- **Rollback:** unset `R2_LIVE` (back to `/__mock-r2` stub).

### 3. MSG91 (SMS/OTP) — outbound only, no webhook
- Set `MSG91_API_KEY`, `MSG91_SENDER_ID`/template ids.
- **Pre-req:** DLT sender ID + template must be **approved** before real OTP delivers.
- Takes effect only at step 6 (no `MSG91_LIVE` flag).
- **Verify (after step 6):** request an OTP to a real handset; confirm delivery + login.

### 4. DigiLocker (KYC) — OAuth callback, no webhook — own `KYC_LIVE` flag
- Set `DIGILOCKER_CLIENT_ID` / `DIGILOCKER_CLIENT_SECRET`, then set `KYC_LIVE=true` (Railway).
- `shouldUseMockKyc` → `false`: `getDigiLockerAuthUrl` / `verifyDigiLockerCallback` (and
  PAN/bank/criminal/faceMatch/liveness) hit real providers instead of returning mock results.
- Inbound point is `GET /api/v1/auth/kyc/callback` (session-authed, carries the OAuth
  `code`). Only verification **status** is stored — never raw Aadhaar/KYC documents.
- **This is independent of the master toggle.** Until `KYC_LIVE=true`, KYC stays mocked — even
  after step 6 flips `USE_MOCK_SERVICES=false`. The mock path still drives a user submission to
  `MANUAL_REVIEW`, so admin `approveKyc` works end-to-end without real DigiLocker. Leave
  `KYC_LIVE` **unset** at launch since DigiLocker registration is still pending; flip it later.
- **Verify (when flipped):** run the DigiLocker consent flow end-to-end; KYC status updates.
- **Rollback:** unset `KYC_LIVE` (back to mock KYC + `MANUAL_REVIEW`).

### 5. Razorpay (payments) — two inbound webhooks
- Railway (API): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
  `RAZORPAY_WEBHOOK_SECRET` (or `RAZORPAY_WEBHOOK_SECRETS=current,previous` for rotation).
- Vercel (web): `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- **Register BOTH webhook endpoints** in the Razorpay dashboard, header
  `x-razorpay-signature`, HMAC-SHA256:
  - `POST https://<api-host>/api/v1/payments/webhook` — bookings/escrow/refunds/disputes/links/subscriptions/payouts
  - `POST https://<api-host>/api/v1/store/webhook/razorpay` — e-commerce order fulfilment
- Idempotency is handled server-side (`webhook_events`, unique `(provider,eventId)`);
  a 7-day replay-age guard drops stale deliveries.
- Takes effect only at step 6.
- **Verify (after step 6):** send a Razorpay test event to each endpoint; expect 200 and a
  `webhook_events` row marked PROCESSED. A bad-signature delivery must get 400 (payments)
  / 401 (store) — this is what `*/webhook.replay.test.ts` proves with real HMAC.

### 6. Flip the master toggle (LAST)
- Set `USE_MOCK_SERVICES=false` (Railway + Vercel). Ensure `ALLOW_MOCK_SERVICES_IN_PROD`
  is **unset**. `MONGO_LIVE`/`R2_LIVE` become redundant but harmless.
- This is when Razorpay, MSG91, and SES go live. **KYC does NOT go live here** — it stays
  mocked until `KYC_LIVE=true` is set separately (step 4). Confirm `KYC_LIVE` is unset so the
  user-facing KYC flow keeps reaching `MANUAL_REVIEW` instead of throwing.
- **Verify:** run steps 3/5 verifies; smoke OTP login, a payment, and a (mocked) KYC submission
  that lands in `MANUAL_REVIEW` for admin approval.
- **Rollback:** set `USE_MOCK_SERVICES=true` (and re-add `MOCK_OTP_VALUE`). All providers
  revert to stubs in one move.

---

## Pre-flip checklist

- [ ] `MONGO_LIVE` verified (step 1) and left on (or master about to flip).
- [ ] `R2_LIVE` verified (step 2).
- [ ] MSG91 DLT sender + template **approved**.
- [ ] DigiLocker client credentials issued. **`KYC_LIVE` left unset** at launch (registration
      pending) — KYC stays mocked and reaches `MANUAL_REVIEW`; flip `KYC_LIVE=true` only later.
- [ ] Both Razorpay webhook endpoints registered with the live `RAZORPAY_WEBHOOK_SECRET`.
- [ ] `ALLOW_MOCK_SERVICES_IN_PROD` unset; `MOCK_OTP_VALUE` removed from prod.
- [ ] CI green incl. `*/webhook.replay.test.ts` and `flagParity.test.ts`.

---

## Drift log (reconciled against code, this task)

- **Runbook was missing.** No `docs/launch/mock-to-real-swap.md` existed on disk or in git
  history before this task (a memory note claimed it was created in "Prompt A"; it never
  landed). This file is the first authoritative version.
- **No `RAZORPAY_LIVE` flag.** Earlier notes listed a `RAZORPAY_LIVE` override; it does not
  exist in `env.ts`. Razorpay is gated by `USE_MOCK_SERVICES` only — corrected above.
- **Two Razorpay webhook endpoints**, not one: `/api/v1/payments/webhook` **and**
  `/api/v1/store/webhook/razorpay`. Both must be registered. (Invalid-signature responses
  differ: payments → 400, store → 401.)
- **MSG91 and DigiLocker have no inbound HMAC webhook.** MSG91 is outbound-only; DigiLocker
  is an OAuth GET callback. Do not configure "webhooks" for them.

See `apps/api/src/__fixtures__/webhooks/README.md` for the verified inbound inventory and
the test net that guards these invariants.
