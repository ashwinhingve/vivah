# Smart Shaadi — Architecture (current state)

> **Last refreshed:** 2026-05-02 · **Source of truth:** the codebase. This document summarizes; conflicts go to code.

---

## System overview (post-Phase 2 / Multi-Event)

```
                              ┌─────────────────────────────────┐
                              │   Browser / Mobile (Phase 7)    │
                              └────────────┬────────────────────┘
                                           │ HTTPS
                                           ▼
              ┌─────────────────────────────────────────────────────────┐
              │   apps/web — Next.js 15 App Router                       │
              │   • Server Components (default)                          │
              │   • Server Actions for all mutations                     │
              │   • shadcn/ui + Tailwind v4                              │
              │   • Sentry (@sentry/nextjs) client + server              │
              │   • PostHog (posthog-js)                                 │
              │   Hosted: Vercel · Region: ap-south-1 (preferred)        │
              └────────────┬────────────────────┬───────────────────────┘
                           │ /api/v1/*          │ Server Actions (RSC)
                           │ rewrite            │
                           ▼                    │
              ┌──────────────────────────────────────────────────────────┐
              │   apps/api — Node.js 20 + Express + TypeScript            │
              │   • Better Auth (TOTP 2FA + OTP) + Drizzle adapter        │
              │   • Pino structured logging w/ PII redaction              │
              │   • Sentry (@sentry/node)                                 │
              │   • Bull queues (11 workers)                              │
              │   • Mock-mode guards on every external service            │
              │   Hosted: Railway · Dockerfile · port 4000                │
              │   Endpoints: /health, /ready, /metrics (M3)               │
              └──────┬─────────┬──────────┬─────────┬─────────┬──────────┘
                     │         │          │         │         │
                     ▼         ▼          ▼         ▼         ▼
                 ┌──────┐ ┌────────┐ ┌──────┐  ┌──────┐ ┌──────────┐
                 │ Pg   │ │ Mongo  │ │Redis │  │ R2   │ │ ai-svc   │
                 │      │ │ Atlas  │ │      │  │      │ │ FastAPI  │
                 └──────┘ └────────┘ └──────┘  └──────┘ └──────────┘
                  Drizzle  Mongoose   Bull +    Pre-     Guna Milan
                  ORM      • content  sessions  signed   X-Internal
                  • core   • chats    • cache   URLs     -Key auth
                    schema • plans                       (M2)

                                External providers
       ┌─────────────────────────────────────────────────────────────┐
       │  Razorpay (payments + payouts)   MSG91 (SMS, OTP)           │
       │  AWS SES (email)                 Daily.co (video)           │
       │  Firebase FCM (push)             AWS Rekognition (KYC face) │
       │  DigiLocker (Aadhaar)            NSDL (PAN)                 │
       │  Refinitiv (sanctions)           Karza (criminal)           │
       └─────────────────────────────────────────────────────────────┘
```

---

## Service responsibilities

### `apps/web` — Next.js frontend

- All UI (customer + vendor + admin)
- Server Components for data display
- Server Actions for mutations (no Next.js API routes)
- Client Components only when browser APIs / event handlers required (`*.client.tsx`)
- Calls api at `https://api.smartshaadi.co.in/api/v1/*` (rewritten in `vercel.json`)

### `apps/api` — Express API

- Authoritative business logic
- 14 feature domains (see § Modules below)
- Direct Postgres + Mongo + Redis + R2 access
- Calls ai-service for Guna Milan + (Phase 3) LLM features
- Owns the Bull queue infrastructure

### `apps/ai-service` — Python FastAPI

- Guna Milan calculation (deterministic Vedic math)
- Phase 3 (deferred): matchmaking explainer, smart replies, planning suggestions
- Receives `X-Internal-Key` from api (gate added in M2)
- Hosted on Railway via Dockerfile (added in M3)

---

## Data layer

### PostgreSQL (Drizzle ORM, `packages/db`)

Source of truth for transactional data:
- `users`, `sessions`, `otp_verifications`, `auth_audit_log`
- `profiles`, `profile_photos`, `profile_views`
- `match_requests`, `match_scores`, `shortlists`, `blocked_users`
- `vendors`, `vendor_services`, `vendor_availability`, `vendor_reviews`
- `bookings`, `booking_items`, `rental_bookings`
- `weddings`, `ceremonies`, `wedding_tasks`, `wedding_vendors`, `wedding_members`
- `payments`, `escrow_accounts`, `payment_splits`, `webhook_events`, `audit_log`
- `guests`, `invitations`, `guest_lists`, `rsvps`
- `kyc_verifications`, `kyc_audit_log`
- `notifications`, `notification_preferences`, `device_tokens`

Migrations: 9 numbered files (`0000–0008`). Generated by `pnpm db:generate`, applied by `pnpm db:push`.

### MongoDB Atlas (Mongoose)

Document-shaped data:
- `profiles_content` — full profile, horoscope, lifestyle (joins on `userId` from Postgres)
- `wedding_plans` — moodboard, detailed budget, timeline
- `chats` — message history per match (TTL by inactivity)
- `vendor_portfolios` — rich media + packages

### Redis (Bull + cache + sessions)

- `bull:<queue>:*` — Bull queue state for 11 workers
- `match_scores:<userId>` — pre-computed match scores (refreshed weekly)
- `pubsub:*` — Socket.io adapter
- Session cache (5-min TTL) — populated on login by Better Auth

### Cloudflare R2 (S3-compatible)

- `smart-shaadi-media` — profile photos, KYC docs, vendor portfolios, recording archives
- Pre-signed URL upload only (files never stream through API)
- Lifecycle policies: KYC docs purged 24h post-verification, recordings 30 days

---

## Feature modules (14)

Each module lives at `apps/api/src/<module>/` with `router.ts` + `service.ts` + `__tests__/`.

| Module | Notes |
|--------|-------|
| `auth` | Better Auth + TOTP + OTP lockout + audit log + soft-delete |
| `profiles` | Personal/family/career/lifestyle + community + safety + horoscope + preferences + family extras |
| `matchmaking` | Engine + filters + scorer + diversity + explainer + personality + sub-modules: `requests/`, `shortlists/` |
| `chat` | Socket.io handlers + conversations + presence + smart replies + link previews |
| `vendors` | Listing + portfolio + favorites + reviews + inquiries + blocked dates |
| `bookings` | Booking flow + invoice generation |
| `rentals` | Equipment/decor rentals with overbook protection |
| `payments` | Razorpay + escrow + disputes + webhooks + sub-modules: wallet, promo, subscriptions, payouts, refunds, reconciliation, splits, statements, csv-export, e-invoice, payment-links |
| `weddings` | Multi-event ceremonies + tasks + sub-modules: coordinator, day-of, activity, documents, expenses, incidents, members, moodboard, public-rsvp, registry, reminders, seating, timeline, vendor-assignments, website |
| `guests` | RSVP + invitations + analytics + CSV export + extras |
| `kyc` | Aadhaar + PAN + bank + criminal + liveness + face-match + sanctions + risk + rate-limit + audit |
| `notifications` | FCM + SES + MSG91 providers + email/SMS templates |
| `users` | Account settings + privacy + notification prefs |
| `admin` | Reconciliation + KYC review + dispute resolution + escrow management |

---

## Cross-cutting concerns

### Authentication & authorization

- Phone OTP → Better Auth → database-backed session
- Optional TOTP 2FA
- Session cookie pinned to canonical name + Domain attribute
- Role enforcement via `authenticate` + `authorize(roles)` middleware (`apps/api/src/auth/middleware.ts:27,83`)
- 6 roles: `INDIVIDUAL`, `FAMILY_MEMBER`, `VENDOR`, `EVENT_COORDINATOR`, `ADMIN`, `SUPPORT`

### Multi-tenant safety

CLAUDE.md rule #2 + #12. Every query filters by `userId` or resolves through `profiles.userId → profiles.id` first. Sample correct pattern: `apps/api/src/weddings/service.ts:104–122`.

### Background jobs (Bull queues)

11 workers registered at `apps/api/src/index.ts` boot:
- `match-compute` — weekly recalc of match scores
- `notifications` — FCM + SES + MSG91 dispatch
- `escrow-release` — auto-release after grace period (CAS guard added in M2)
- `order-expiry` — booking timeouts
- `match-request-expiry` — 7-day request timeout
- `rsvp-reminder`, `save-the-date`, `thank-you` — wedding journey
- `token-cleanup` — expired session purge
- `payments-reconcile` — daily Razorpay vs DB diff
- `wedding-reminder` — pre-event reminders
- `invitation-blast` — bulk RSVP send (worker added in M2)

Deterministic `jobId`s prevent duplicates.

### Observability stack

- **Sentry** — `apps/api/src/lib/sentry.ts` (api), `apps/web/sentry.{client,server}.config.ts` (web), `apps/ai-service/src/main.py` (added in M2)
- **Pino** — `apps/api/src/lib/logger.ts` with redaction list
- **PostHog** — web client (autocapture off), api server-side (added in M3)
- **Prometheus** — `/metrics` endpoint added in M3
- **`/health`** — process alive
- **`/ready`** — DB + Redis + Mongo reachable (added in M2)
- **BetterStack** — uptime monitoring on canonical URLs

### Mock-mode infrastructure

`USE_MOCK_SERVICES=true` swaps every external provider for in-process mocks backed by `apps/api/src/lib/mockStore.ts` (persists to disk at `apps/api/.data/mockStore.json`). The mock layer is symmetric: switching to real providers is a single env flag.

77 source files reference `USE_MOCK_SERVICES`. Per-provider flags (`USE_RAZORPAY_MOCK`, etc.) allow staged switch-on.

---

## Deployment

### Web (Vercel)

- Trigger: push to `main`
- Build: `vercel.json` chains `types` → `schemas` → `web`
- Rewrites `/api/v1/*` → `https://api.smartshaadi.co.in/api/v1/*`
- Preview URL on every PR

### API (Railway)

- Trigger: push to `main`
- Build: `apps/api/Dockerfile` (Node 20-alpine, 2-stage)
- Healthcheck: `/health`
- Region: `ap-south-1` (Mumbai)

### AI service (Railway, M3)

- Dockerfile + Railway service config added in M3
- Same region

### Databases

- **Postgres:** Supabase (managed). Schema applied via `pnpm db:push` against staging; never auto-applied to prod (manual gated migration).
- **Mongo:** MongoDB Atlas. Indexes managed by Mongoose `init` on startup.
- **Redis:** Railway-hosted Redis 7. Persistence: AOF.
- **R2:** Cloudflare. Lifecycle policies in Terraform (planned M3+).

---

## CI/CD

Single GitHub Actions workflow at `.github/workflows/ci.yml`:

```
push/PR → quality (type-check + lint)
       → test (unit + integration with postgres+redis service containers)
       → build (turbo build all apps)
       → e2e (PR-only, against Vercel preview URL — Playwright config added in M3)
       → release (main-only) — currently echo marker; Vercel/Railway auto-deploy
```

M3 additions: gitleaks, coverage gate (≥70% api), husky pre-commit.

---

## Repository layout (monorepo)

```
apps/
├── web/          Next.js 15
├── api/          Node.js + Express
├── ai-service/   Python FastAPI
└── (mobile/)     Phase 7 — does not exist yet

packages/
├── db/           Drizzle schema + migrations
├── types/        Shared TypeScript types
└── schemas/      Shared Zod schemas (single source of truth)

prompts/          Versioned LLM prompt files
docs/             Architecture, API, DB, runbooks, provider activation kit
infrastructure/   docker-compose for local dev
scripts/          Migration helpers
.github/workflows/ CI definition
```

---

## What changes after provider activation

The architecture itself does not change. Only env flags flip. The mock layer (`apps/api/src/lib/mockStore.ts` + per-provider mock guards) is the only code that goes dormant when real providers are active. Production behavior is identical to mock-mode behavior in every code path that doesn't touch the external service directly — meaning the staging demo is a faithful preview of production.

See `docs/PROVIDER-ACTIVATION/` for the per-provider switch-on procedure.

---

## What changes in Phase 3 (AI Intelligence Layer)

ai-service grows new routers:
- `/ai/matching/explain` — matchmaking explainer
- `/ai/chat/smart-reply` — bilingual reply suggestions
- `/ai/wedding/suggest` — task auto-suggestions

All gated on `X-Internal-Key`. All cached via Helicone proxy. All trace-instrumented (OpenTelemetry).

api gets a new domain `apps/api/src/ai/` that proxies + enriches + caches. Frontend opts in to AI features per user (privacy default: off).

---

## What changes in Phase 7 (Mobile)

`apps/mobile/` lands as React Native + Expo. Reuses `packages/types` + `packages/schemas`. Talks to the same `/api/v1/*` endpoints. Web is web — no shared rendering.

---

## Reference documents

| Doc | Contents |
|-----|----------|
| `docs/API.md` | endpoint catalog (auto-gen target M3) |
| `docs/DATABASE.md` | schema glossary + ER notes |
| `docs/SETUP.md` | local dev setup steps |
| `docs/MASTER-PLAN.md` | strategic project plan |
| `docs/PROVIDER-ACTIVATION/` | 11 provider runbooks + index |
| `docs/CLIENT-PRESENTATION.md` | client meeting deck source |
| `docs/SECURITY-REVIEW.md` | security posture summary |
| `docs/DEMO-SCRIPT.md` | live demo walkthrough |
| `docs/RUNBOOK.md` | incident response (M3) |
| `docs/KYC-PROVIDERS.md` | KYC adapter decisions (M2) |
| `~/.claude/plans/you-are-a-software-pure-penguin.md` | stabilization plan |
