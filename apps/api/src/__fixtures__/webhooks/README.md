# Inbound Integration Inventory — verified against code (mock→real swap safety net)

Canonical inbound payloads + the replay/parity test net that must stay green so the
real-credential swap is low-risk. **Mocks stay ON; no real credentials here.**

## Inbound webhooks / callbacks

| Provider | Inbound? | Route | Mechanism | Verified by |
|---|---|---|---|---|
| **Razorpay (payments)** | HMAC webhook | `POST /api/v1/payments/webhook` | HMAC-SHA256 hex over the **raw** body, header `x-razorpay-signature` | `payments/__tests__/webhook.replay.test.ts` |
| **Razorpay (store)** | HMAC webhook | `POST /api/v1/store/webhook/razorpay` | same HMAC-SHA256, header `x-razorpay-signature` | `store/__tests__/webhook.replay.test.ts` |
| **DigiLocker** | OAuth2 GET callback (no HMAC) | `GET /api/v1/auth/kyc/callback` | user session + short-lived auth `code`; mock mode returns a synthetic result | `kyc/__tests__/callback.replay.test.ts` |
| **MSG91** | **none** | — | Outbound OTP/SMS only — there is no inbound MSG91 webhook in this codebase | n/a |

## Signature details (Razorpay)

- Verifier: `verifyWebhookSignature(rawBody, signature)` in `apps/api/src/lib/razorpay.ts`
  — `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`, constant-time compare.
- Secret env: `RAZORPAY_WEBHOOK_SECRET`, or `RAZORPAY_WEBHOOK_SECRETS` (comma-separated, for
  key rotation — accepts current+previous).
- **Mock bypass:** when `USE_MOCK_SERVICES=true`, `verifyWebhookSignature` returns `true`
  unconditionally. The replay tests therefore mock `lib/env.js` with `USE_MOCK_SERVICES=false`
  and do **not** mock `lib/razorpay.js`, so the real HMAC path is exercised.
- Both Razorpay routes mount with `express.raw({ type: '*/*' })` **before** `express.json()`
  (index.ts) so the verifier sees the exact signed bytes.
- Idempotency: `webhook_events` table via `recordWebhookEvent` (unique `(provider, eventId)`);
  duplicate deliveries short-circuit before any side-effect. Replay-age guard drops events
  older than 7 days (`payments/webhook.ts`), so replay tests stamp `created_at` to now.

## Flags (the demo-week mismatch class)

`lib/env.ts` (all boolean, default false): `USE_MOCK_SERVICES`, `MONGO_LIVE`, `R2_LIVE`,
`ALLOW_MOCK_SERVICES_IN_PROD`; plus `MOCK_OTP_VALUE` (required when mock is on).

Derived gates — read and write paths must use the **same** one per store:
- `shouldUseMockMongo = USE_MOCK_SERVICES && !MONGO_LIVE`
- `shouldUseMockR2    = USE_MOCK_SERVICES && !R2_LIVE`

There is **no `RAZORPAY_LIVE` flag** — Razorpay is gated by `USE_MOCK_SERVICES` alone.
`__tests__/flagParity.test.ts` asserts the 8-combo truth table and that the Mongo
(`content.service.ts`) and R2 (`storage/service.ts`) read/write paths agree — the exact
divergence that broke ProfileContent reads in demo week.

See `docs/launch/mock-to-real-swap.md` for the full swap runbook.
