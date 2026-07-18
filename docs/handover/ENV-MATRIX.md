# Environment Variable Matrix

> Phase 8 Sprint H (Unit 8.3). Source of truth is `apps/api/src/lib/env.ts` — that file
> validates every variable through Zod at boot and **refuses to start** on a bad config.
> If this table and `env.ts` ever disagree, `env.ts` is right and this file is stale.

## How the mock/live system works

There are two independent layers, and confusing them is the most common misconfiguration.

**Layer 1 — the master switch.** `USE_MOCK_SERVICES=true` makes every external
integration use an in-process fake. This is the normal state of local development and of
production right now (pre-launch).

**Layer 2 — per-service escape hatches.** Each `*_LIVE` flag re-enables one real
integration *even while the master switch is on*. This is what lets us run real Cloudflare
R2 and real Daily.co video today while Razorpay and MSG91 stay mocked pending the
Colonel's registrations.

Two consequences worth internalising:

- **Every `*_LIVE` flag defaults to `false`.** Nothing talks to a real provider unless
  someone deliberately turned it on. Forgetting a flag makes a feature mocked, never
  accidentally live.
- **`REPORTS_ENABLED` inverts this convention and defaults to `true`.** It is deliberately
  *not* named `*_LIVE`, because it gates no provider — see [Kill-switches](#kill-switches).

`ALLOW_MOCK_SERVICES_IN_PROD` exists because `env.ts` otherwise refuses to boot with
`USE_MOCK_SERVICES=true` under `NODE_ENV=production`. It is a pre-launch-only override.
**Turning it off is part of the go-live checklist**, not an optional cleanup.

## Master switches

| Variable | Default | Meaning |
|---|---|---|
| `USE_MOCK_SERVICES` | `false` | Master mock switch. Currently `true` in production. |
| `ALLOW_MOCK_SERVICES_IN_PROD` | `false` | Permits the combination above in production. Pre-launch only. |
| `NOTIFICATIONS_WORKER_ENABLED` | `false` | Opt in to running the notifications worker while mocked. |
| `MOCK_OTP_VALUE` | *(none)* | Required when `USE_MOCK_SERVICES=true`. No default by design — a guessable default OTP would be a real auth hole. |

## Per-service live overrides

| Flag | Default | Prod today | Unblocks when | Owner |
|---|---|---|---|---|
| `MONGO_LIVE` | `false` | **true** | — already live | Ashwin |
| `R2_LIVE` | `false` | **true** | — already live | Ashwin |
| `VIDEO_LIVE` | `false` | **true** | — already live | Ashwin |
| `KYC_LIVE` | `false` | false | DigiLocker credentials | Colonel |
| `ESIGN_LIVE` | `false` | false | DigiLocker / Signzy agreement | Colonel |
| `WHATSAPP_LIVE` | `false` | false | Meta Business + BSP approval (7–14 d) | Colonel |
| `LENDING_LIVE` | `false` | false | NBFC/aggregator + RBI DLG compliance | Colonel |
| `INSURANCE_LIVE` | `false` | false | IRDAI insurer/aggregator agreement | Colonel |

Razorpay and MSG91 have **no** `*_LIVE` flag — they follow `USE_MOCK_SERVICES` directly
and go live when the master switch flips. Those two, plus legal sign-off, are the three
launch blockers.

## Feature gates

These are not part of the mock matrix. They gate behaviour, not providers.

| Flag | Default | What `false` means |
|---|---|---|
| `RETENTION_OUTREACH_LIVE` | `false` | Churn sweep computes and stores `DRY_RUN` attempts for admin review but messages nobody. Also requires `USE_MOCK_SERVICES=false` to actually send. |
| `NRI_MATCHING_LIVE` | `false` | The cross-border escape hatch in `passesDistanceFilter` is never taken; the 100 km rule applies to every pair. NRI profile fields still save — they just don't affect matching. Deliberately *not* gated on `USE_MOCK_SERVICES`, since it calls nothing external and would otherwise be untestable in the mock mode the whole dev environment runs in. |
| `FEED_DEBUG` | `false` | Verbose matchmaking trace logging off. |
| `SENTRY_TEST_ENABLED` | `false` | The `/sentry-test` verification endpoint is not mounted. |

## Kill-switches

| Flag | Default | What `false` means |
|---|---|---|
| `REPORTS_ENABLED` | **`true`** | PDF report endpoints return 503; nothing else is affected. |

`REPORTS_ENABLED` breaks the `*_LIVE`/default-false convention on purpose. Reports call no
external provider and carry no go-live risk, so there is nothing to keep mocked — shipping
them switched off would just mean shipping a dead feature. It exists solely as a
load-shedding lever: report rendering is synchronous, CPU-heavy PDFKit work on the API
process, so ops needs a way to shed it during an incident without waiting for a deploy.

## Infrastructure

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `4000` | |
| `DATABASE_URL` | *required* | PostgreSQL. Never paste the production value into chat — rotate if leaked. |
| `MONGODB_URI` | `mongodb://localhost:27017/smartshaadi` | |
| `REDIS_URL` | *required* | Sessions, match cache, Bull queues |
| `API_BASE_URL` | `http://localhost:4000` | |
| `WEB_URL` | `http://localhost:3000` | |
| `CORS_ORIGIN` | `''` | Allowlist — see `docs/adr/ADR-002-cross-origin-cookies-cors.md` |
| `AI_SERVICE_URL` | `http://localhost:8000` | |
| `AI_SERVICE_INTERNAL_KEY` | `internal-key-change-in-prod` | **Must be changed in production** — the default is a placeholder. |

## Secrets

Validated conditionally: `env.ts` requires each group only when its corresponding `*_LIVE`
flag is on, so local development needs none of them.

| Group | Variables |
|---|---|
| Auth | `BETTER_AUTH_SECRET`, `JWT_SECRET` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_WEBHOOK_SECRETS` (comma-separated, for rotation), `RAZORPAY_ACCOUNT_ID` |
| Storage | `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_PUBLIC_URL` |
| Email | `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_REGION`, `AWS_SES_FROM` |
| Push | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| Video | `DAILY_CO_API_KEY` |
| WhatsApp | `WHATSAPP_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| Financial | `LENDING_API_KEY`, `INSURANCE_API_KEY` |
| e-Invoice | `EINVOICE_API_KEY`, `EINVOICE_THRESHOLD` (default `500000`) |
| Vision | `AWS_REKOGNITION_REGION` |

## Observability

| Variable | Default | Notes |
|---|---|---|
| `SENTRY_DSN` | `''` | Empty disables Sentry entirely (no-op init) |
| `SENTRY_ENVIRONMENT` | `development` | |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | 0–1 |
| `METRICS_TOKEN` | `''` | Bearer token gating `GET /metrics`. **Empty means the endpoint is unauthenticated** — set it in production. |

## Platform config

| Variable | Default |
|---|---|
| `PLATFORM_GSTIN` | `27AAAAA0000A1Z5` (placeholder — replace with the real GSTIN at launch) |
| `PLATFORM_STATE` | `Maharashtra` (drives CGST/SGST vs IGST on invoices) |

## Go-live checklist

Config changes required at launch, beyond the provider credentials themselves:

1. `USE_MOCK_SERVICES=false` — the flip that takes Razorpay + MSG91 live.
2. `ALLOW_MOCK_SERVICES_IN_PROD=false`.
3. `METRICS_TOKEN` set to a real secret (otherwise `/metrics` is public).
4. `AI_SERVICE_INTERNAL_KEY` changed off its placeholder default.
5. `PLATFORM_GSTIN` set to the real registered GSTIN.
6. `SENTRY_DSN` + `SENTRY_ENVIRONMENT=production` set.
7. `SENTRY_TEST_ENABLED=false`.
8. Confirm every `*_LIVE` flag whose provider is *not* yet approved is still `false`.

Env vars live in three places and must be updated in all of them: Railway (API + AI
service), Vercel (web), and local `.env`. Never commit `.env`.

## Related

- `apps/api/src/lib/env.ts` — the authoritative schema and its boot-time guards
- `docs/PROVIDER-ACTIVATION/` — 15 per-provider setup guides
- `docs/handover/SCALING-PLAYBOOK.md`
- `docs/adr/ADR-002-cross-origin-cookies-cors.md`
