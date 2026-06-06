# Smart Shaadi — Claude Code Context

> **Read this before every session. Update it when anything changes.**
> This file is auto-read by Claude Code at session start.

---

## Project Identity

- **Name:** Smart Shaadi
- **Type:** National Smart Marriage-Centric Event Ecosystem
- **Client:** Colonel Deepak
- **Developer:** Ashwin Hingve (sole execution owner)
- **Agreement date:** 05 April 2026
- **Stack:** TypeScript end-to-end · Node.js API · Python AI service · Next.js web · (React Native mobile deferred to Phase 7)

---

## Current Status

```
Phase:     2 → COMPLETE ✅ + Multi-Event/Polish world-class upgrade landed
           Phase 3 + 4 shipped; Path B (P1-7/8) closed 2026-05-20
Week:      10 → IN PROGRESS
Focus:     Pre-launch — every code-fixable P0 + P1 closed; awaiting external
           registrations (MSG91 DLT, DigiLocker, Razorpay live, Daily.co).
Status:    docs/PHASE-1-4-AUDIT.md Resolution Log fully populated. Open P0s = 4
           (all external-blocked). Open P1s = 0 code-fixable (P1-5 NIC IRP +
           P1-11 Daily.co external-blocked).
Mocks:     `USE_MOCK_SERVICES=false` in `.env.production.example`; env.ts
           hard-rejects `NODE_ENV=production && USE_MOCK_SERVICES=true`.
           Local-dev mock value REQUIRED via `MOCK_OTP_VALUE` (no default).
Last session: 2026-05-20 — Path B: vendor approval workflow (P1-8) + Recent
  Conversations dashboard wire-up (P1-7). 4 commits aed23df / 516a156 /
  610128e / (this docs commit). Vendor approval state machine (DRAFT→
  PENDING→UNDER_REVIEW→APPROVED/REJECTED/SUSPENDED) with CAS-locked
  transitions, admin queue at /admin/vendors, review page with claim
  mechanism + reject/suspend modals, vendor-side status banner on
  /vendor-dashboard. Public `listVendors` now filters `status='APPROVED'`.
  Migration SQL pending Railway console application — see
  `docs/MIGRATIONS-PENDING.md`. GET /api/v1/chat/recent endpoint feeds
  the customer dashboard's Recent Conversations card with live rows
  (presence + unread badges + photo or initials avatar). 669/669 api
  tests + 278 ai-service tests + 2 web tests; type-check 0; build 0.

Prior session: 2026-05-20 — Sprint 0 Parts 1+2 closed 13 of 15 P1s + 4
  zero-dependency P0s. See PHASE-1-4-AUDIT.md Resolution Log for full
  per-item provenance.

Earlier: 2026-05-04 — P0 hardening: closed SSRF DNS-rebinding gap (chat/linkPreview)
  + booking double-book race (unique partial index `booking_active_unique_idx`,
  23505 → BOOKING_CONFLICT). Verified other 8 P0s already fixed in Milestone A
  (993b3bb) + May-3 webhook idempotency landing. All 511 tests green; type-check
  8/8; lint clean. See docs/phase1-2-code-review.md for per-item resolution map.
  - Phase 0 single agent: ceremony types + muhurat schemas + deterministic escrow jobId (c493cd3)
  - Phase 1 agent team (3 teammates parallel):
      video-hardening (9673d3a): deterministic Redis room storage + 409 on duplicate + GET /rooms/:matchId + SCAN cursor loop + respondMeeting status/matchId guards + TTL from scheduledAt + VideoCall proposer profileId fix
      escrow-hardening (5d428a1): escrowReleaseQueue moved to infrastructure/redis/queues.ts + cancel by deterministic jobId + optimistic lock on raise/resolveDispute + DB-before-Razorpay with RELEASE_PENDING/REFUND_PENDING fallbacks + audit enum swap to DISPUTE_RAISED/DISPUTE_RESOLVED_* + admin UI resolved-state lift
      rental-hardening + ceremonies (e1311a6, 936a708): tx-wrapped overbook guard + PUT /activate + availableQty + public fetch on browse pages + /rentals/bookings/mine page + confirmRentalBooking crash guard; wedding ceremony CRUD + muhurat suggest/select with Ceremonies tab + Muhurat card on wedding overview
  - Phase 2 single agent: pnpm db:push applied RELEASE_PENDING + REFUND_PENDING enum additions; full smoke 15/15 API + 4/4 web pages pass (e7f9cc3)
  - Tests: 277/277 green (was 239 + 38 new). Type-check clean 8/8.
  - Known issue flagged for Week 9: GET /api/v1/profiles/matches (and similar routes with :profileId) crashes API on non-UUID segment — unhandled Postgres uuid parse error; needs error-handler middleware
  - Mock mode: Daily.co still mocked (DAILY_CO_API_KEY not set)
```

> **Update this block at the start of every session.**

---

## Current Production State (as of 2026-05-10)

```
Phase 3: 6 of 6 features shipped
  - Conversation Coach (Sonnet)
  - Emotional Score (HuggingFace XLM-RoBERTa)
  - DPI (Calibrated LogReg)
  - FII (7-signal weighted + Sonnet narrative)
  - FAQ (Calibrated Gradient Boosting)
  - Stay Quotient (Calibrated LogReg)

Phase 4 Day 1: Subscriptions
  - Mock Razorpay live (env-flag controlled)
  - 4 plans seeded (Standard M/Y + Premium M/Y)
  - /settings/billing page wired
  - expireGracePeriods cron at 02:00 IST

Phase 4 Day 2: Auto-SEO + Sentry
  - 22 programmatic SEO routes (6 communities + 10 cities + 6 castes)
  - Sentry wired across api / ai-service / web (DSN env vars + auth token in Vercel)

Phase 4 Day 3: docs + BetterStack monitor setup (manual)
  - See docs/monitoring/betterstack-setup.md
```

---

## Repository Structure

```
apps/web/          → Next.js 15 App Router (frontend + Server Actions)
apps/api/          → Node.js/Express/TypeScript (core REST API)
apps/ai-service/   → Python/FastAPI (ML scoring, AI matchmaking, fraud)
# apps/mobile/     → DEFERRED to Phase 7 (not yet scaffolded)
packages/types/    → Shared TypeScript types (used by all apps)
packages/schemas/  → Shared Zod validation schemas
packages/db/       → Drizzle ORM schema + migrations (PostgreSQL)
prompts/           → Versioned AI prompt files (chat-system-v1.md etc.)
docs/              → Architecture, API, database documentation
.claude/commands/  → Custom Claude Code slash commands
```

---

## Commands

```bash
pnpm dev            # Start all services (Turborepo — runs all apps in parallel)
pnpm test           # Run Vitest unit tests
pnpm e2e            # Run Playwright E2E tests
pnpm type-check     # TypeScript strict mode check across all packages
pnpm lint           # ESLint across monorepo
pnpm db:push        # Push Drizzle schema to PostgreSQL (dev only)
pnpm db:generate    # Generate new migration files
pnpm db:seed        # Seed local dev database with test data
pnpm db:studio      # Open Drizzle Studio visual browser
```

---

## Production Deploy & DB Sync

**Hosts**
- Web: Vercel (auto-deploys `main` push)
- API: Railway / Docker (auto-deploys `main` push, builder runs `tsc` then runs `dist/src/index.js`)
- Postgres: Railway-managed; public proxy at `shortline.proxy.rlwy.net:<port>`

**Schema sync workflow** (when prod DB drifts from `packages/db/schema/`)
- **Run from Windows PowerShell, not WSL** — this dev box's WSL2 cannot reach the Railway proxy IPs (ETIMEDOUT). Schema ops, drizzle-studio, ad-hoc psql must run from native Windows shell.
- PowerShell env-var syntax: `$env:DATABASE_URL = '...'` (single line — newlines become part of the value if split). Cleanup: `Remove-Item Env:\DATABASE_URL`.
- `pnpm install` once on the Windows side too — `node_modules` from WSL is not visible to Windows pnpm.

**`drizzle-kit push` failure modes**
- **Error 42P16 `column "id" is in a primary key`**: drizzle crashes during schema pull (before showing any plan) when Better Auth tables (`user`/`session`/`account`/`verification`/`two_factor`) have text-id PK columns — it tries `ALTER COLUMN` without dropping the PK first. `db:push` is **completely unusable** against this prod DB. Do NOT retry. Use the Railway SQL console fallback instead (see below).
- **Data-loss warning on column type change**: drizzle wants to change e.g. `text` → `varchar(N)` — always select **"No, abort"**. Fix by updating the schema to match prod (change to `text`) so no migration is emitted.
- `drizzle-kit generate` writes an empty `.sql` file when local schema matches drizzle's last meta snapshot. It will **not** detect prod-DB drift — only `push` does.

**Production migration fallback — Railway SQL console (use this instead of db:push)**

`psql` is not installed on this machine. The only way to run SQL against Railway prod is:
Railway Dashboard → Postgres service → **Data tab → Query**.

For each pending migration file (`packages/db/migrations/00NN_*.sql`), paste the content
into the Query box. The files are already idempotent (`IF NOT EXISTS`, `duplicate_object`
guards) — safe to re-run. Apply **one file at a time**, verify row counts after each.

**Never apply 0029_pgvector_embedding.sql** until you first confirm pgvector is available:
```sql
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```
If that returns no rows, stop — contact Railway support to enable the extension.

**Push-pipeline credentials**
- Both `git push` (when WSL session runs `gh auth login` first) and Railway/Vercel CI auto-build on `main`. Pushing without `gh auth` fails with "could not read Username for 'https://github.com'" — switch to SSH remote or run `gh auth login` to fix.
- Never paste a prod `DATABASE_URL` containing the password into chat — rotate immediately if leaked.

---

## Production DB Migration Protocol

**Where to run from:** Native Windows PowerShell only. WSL2 cannot route to Railway's
`shortline.proxy.rlwy.net` (ETIMEDOUT). Run all production drizzle-kit pushes from
PowerShell against `D:\Do Not Open\vivah\vivahOS\packages\db`.

**Drizzle-kit location after pnpm install:**
`D:\Do Not Open\vivah\vivahOS\node_modules\.pnpm\drizzle-kit@<version>\node_modules\drizzle-kit\bin.cjs`

Find the current version path with:

```powershell
Get-ChildItem -Path . -Filter "bin.cjs" -Recurse | Where-Object { $_.FullName -like "*drizzle-kit*" }
```

**Pre-flight (mandatory):**
1. Backup production DB via Railway dashboard → Postgres → Data → Backups → "Create backup now"
2. Run against LOCAL DB first to preview diff: `pnpm --filter @smartshaadi/db db:push`
3. Audit local `push.log` for: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `42P16` errors. Any of these = STOP.
4. Confirm diff is additive-only (`CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, `ALTER TYPE ... ADD VALUE`, `ADD CONSTRAINT`)

**Push command (interactive — do NOT pipe empty stdin; the operator must see and
answer drizzle's destructive-change prompts; the Railway backup from pre-flight
step 1 is the safety net):**

```powershell
cd 'D:\Do Not Open\vivah\vivahOS'
pnpm install                       # once: WSL-built node_modules are not usable by Windows node
cd 'D:\Do Not Open\vivah\vivahOS\packages\db'

# single line — a wrapped value embeds a newline in the URL
$env:DATABASE_URL = '<prod DATABASE_URL — never commit this literal>'

node ..\..\node_modules\.pnpm\drizzle-kit@<version>\node_modules\drizzle-kit\bin.cjs push --verbose | Tee-Object -FilePath push.log
# answer "No" to any DROP / TRUNCATE / ALTER COLUMN prompt — apply additive changes only

Remove-Item Env:\DATABASE_URL
```

**Interactive prompts — how to answer:**
- "Truncate table to add unique constraint?" → ALWAYS "No, add the constraint without truncating"
  - If the constraint then fails, fix the data manually first (SQL console), then re-run push
- "Rename column from X to Y?" → STOP. Paste the prompt before answering. Renames need a manual
  two-step migration (add new column → backfill → drop old) to preserve data.
- "Drop column X?" → STOP. Never accept.

**Fallback for non-additive changes:**
If drizzle wants to do anything destructive (DROP, TRUNCATE, RENAME), extract only the additive
statements from push.log into additive.sql and apply via Railway's web SQL console (Data tab → Query).
Better Auth tables (user, session, account, verification, two_factor) are especially prone to
42P16 errors — never alter their PKs through drizzle-kit. Treat them as read-only via this tool.

**Connection blocker pattern:**
WSL2 cannot reach Railway's proxy URLs. Always use PowerShell for production. Local DB pushes
can run from either WSL or PowerShell — local Postgres is reachable from both.

**Post-flight:** Re-run the push — it should report no remaining drift; only the
`duplicate_object`-guarded `ADD CONSTRAINT` blocks re-emit, and those are no-ops.

**Security:** Rotate Railway Postgres password if the DATABASE_URL has been pasted anywhere
visible (chat, logs, screenshots). Update: Railway env vars + Vercel env vars + local .env.

---

## Tech Stack (Full)

```
Frontend:    Next.js 15 App Router · TypeScript strict · shadcn/ui · Tailwind v4
Mobile:      (Phase 7 — React Native 0.78 + Expo SDK 55 + Expo Router v4 + NativeWind, not yet scaffolded)
Core API:    Node.js · Express · TypeScript · Drizzle ORM (PostgreSQL)
AI Service:  Python 3.11 · FastAPI · Scikit-learn · HuggingFace · PyTorch
Databases:   PostgreSQL (Supabase/Railway) · MongoDB Atlas · Redis (Railway)
Storage:     Cloudflare R2 (S3-compatible, no egress fees)
Auth:        Better Auth · Phone OTP · session cookie (30-day, httpOnly, 5-min in-memory cache)
Payments:    Razorpay (UPI, cards, wallets, EMI, Subscriptions)
SMS/OTP:     MSG91 (DLT-registered sender)
Email:       AWS SES
Push:        Firebase FCM
AI/LLM:      Anthropic Claude API via Helicone proxy
Monitoring:  Sentry · PostHog · Helicone · BetterStack
CI/CD:       GitHub Actions → Vercel (web) + Railway (API + AI service)
```

---

## Architecture Rules — NEVER Violate These

1. **All LLM calls MUST route through `apps/ai-service/`** or `apps/web/lib/ai/index.ts`. Never call Anthropic API directly from components, Server Actions, or any other layer.

2. **All database queries MUST be filtered by `userId` or relevant tenant identifier.** Multi-tenant safety is non-negotiable.

3. **Use Server Actions for ALL mutations** in the Next.js app. Never create an API route in Next.js for something a Server Action can handle.

4. **Never use `any` in TypeScript.** Always provide proper types. If you don't know the type, use `unknown` and narrow it.

5. **Phone numbers and email addresses NEVER appear in API responses by default.** Always masked until the user explicitly unlocks contact sharing with a specific match.

6. **All file uploads go directly to Cloudflare R2 via pre-signed URLs.** Never stream files through the Next.js or Node.js API — memory limits and performance.

7. **Redis for all session data and match score cache.** Never store in application memory. Sessions expire in 30 days, match scores recalculated weekly.

8. **All background jobs run via Bull queues (Redis-backed).** Never send notifications, emails, or SMS synchronously inside a request handler.

9. **Guna Milan algorithm in `apps/ai-service/routers/horoscope.py`.** This is deterministic Vedic math, not ML. All 8 Ashtakoot factors must be correct.

10. **Reciprocal Matching engine checks both sides before surfacing any profile.** No one-sided recommendations ever appear in the match feed.

11. **Every service that calls MongoDB MUST guard with `if (env.USE_MOCK_SERVICES)`** and fall back to `mockGet`/`mockUpsertField`/`mockUpsertDotFields` from `apps/api/src/lib/mockStore.ts`. `connectMongo()` skips the connection when mock mode is on, so any unguarded Mongoose call will buffer for 10s then crash. Affected services: `content.service.ts`, `horoscope.service.ts`, `preferences.service.ts`, `safety.service.ts`, `service.ts` — and any new service you add that touches `ProfileContent`.

12. **Always resolve `userId` → `profileId` before any query that touches tables referencing `profiles.id`** — never pass the Better Auth `userId` directly to profile-keyed columns (`weddings.profileId`, `profile_photos.profileId`, `match_requests.fromProfileId`, etc.). `userId` (Better Auth) and `profileId` (profiles.id UUID) are **different values**. Resolve via `db.select({id: profiles.id}).from(profiles).where(eq(profiles.userId, userId))`, or JOIN `profiles` in the same query. Skipping this check silently falls through as 403 Forbidden in every request.

---

## Verification Protocol — non-negotiable

Code is not "verified" until:
1. pnpm type-check passes (catches compile errors)
2. pnpm build passes (catches build-time errors)
3. The affected pages are opened in a browser locally
4. Key interactions are clicked manually
5. Network tab shows no 500s from Server Components
6. Console shows no React errors

Especially when refactoring Server Components: the component will compile
and build even when it throws at request time. type-check + build alone
is NOT sufficient verification.

---

## Code Conventions

```
Components:      ComponentName.client.tsx (needs browser) | ComponentName.tsx (server default)
DB queries:      All in packages/db/ — never inline in components or Server Actions
AI calls:        All in apps/ai-service/ (Python) or apps/web/lib/ai/ (TS proxy)
Prompt files:    prompts/feature-name-v1.md — never edit in place, always bump version
Error types:     Always typed — never throw generic Error() in business logic
API responses:   Always use the standard envelope: { success, data, error, meta }
```

---

## User Roles

```typescript
type UserRole = 
  | 'INDIVIDUAL'        // Matchmaking user
  | 'FAMILY_MEMBER'     // Wedding plan collaborator
  | 'VENDOR'            // Service provider
  | 'EVENT_COORDINATOR' // Multi-event booking
  | 'ADMIN'             // Platform management
  | 'SUPPORT'           // Complaint resolution
```

---

## Database Overview

```
PostgreSQL (via Drizzle ORM):
  user, session, verification          (Better Auth — singular names)
  profiles (metadata), profile_photos
  match_requests, match_scores, blocked_users
  vendors, vendor_services, vendor_blocked_dates
  bookings, booking_addons
  weddings, wedding_tasks, wedding_vendor_assignments
  payments, escrow_accounts, payment_splits
  guests, invitations, guest_lists
  rental_items, rental_bookings
  products, orders, order_items
  notifications, notification_preferences

MongoDB Atlas (via Mongoose):
  profiles_content  → full profile data, horoscope, lifestyle
  wedding_plans     → theme, mood board, detailed budget
  chats             → message history per match
  vendor_portfolios → rich media, packages, FAQs

Redis:
  sessions:*        → Better Auth session metadata + cookie-cache invalidation keys
  match_scores:*    → pre-computed match scores (weekly refresh)
  queue:*           → Bull job queues (notifications, emails, SMS)
  pubsub:*          → Socket.io adapter for multi-instance chat
```

---

## Environment Variables (Required)

```bash
# PostgreSQL
DATABASE_URL=postgresql://...

# MongoDB
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=redis://...

# Auth
JWT_SECRET=...
BETTER_AUTH_SECRET=...

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=smart-shaadi-media

# Payments
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Communications
MSG91_API_KEY=...
MSG91_SENDER_ID=...
AWS_SES_ACCESS_KEY=...
AWS_SES_SECRET_KEY=...
AWS_SES_REGION=ap-south-1
FIREBASE_SERVICE_ACCOUNT=...

# KYC
DIGILOCKER_CLIENT_ID=...
DIGILOCKER_CLIENT_SECRET=...

# AI/LLM
ANTHROPIC_API_KEY=...
HELICONE_API_KEY=...

# Video calls
DAILY_CO_API_KEY=...

# AI Service URL (internal)
AI_SERVICE_URL=http://localhost:8000
```

---

## What NOT to Do

- Do NOT use `use client` unless the component genuinely needs browser APIs or event handlers
- Do NOT create API routes in Next.js for mutations (use Server Actions)
- Do NOT commit `.env` files — use Railway/Vercel env var dashboards
- Do NOT call LLM APIs directly from frontend components or Server Actions
- Do NOT store Aadhaar numbers or raw KYC data — store verification status only
- Do NOT make blocking LLM calls inside request handlers — use Bull queues
- Do NOT store sensitive data in localStorage — use httpOnly cookies for tokens
- Do NOT skip writing tests for: Guna Milan algorithm, escrow logic, payment webhooks

---

## Phase 3 + 4 Patterns

### Env-flag conventions

| Flag | Purpose |
|------|---------|
| `USE_MOCK_SERVICES` | Global mock master switch |
| `MONGO_LIVE` | Real MongoDB vs in-memory mock store |
| `RAZORPAY_LIVE` | Real Razorpay SDK vs mock (Phase 4 Day 1) |
| `FEED_DEBUG` | Verbose matchmaking feed logs |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `SENTRY_TRACES_SAMPLE_RATE` | Production error tracking |
| `SENTRY_TEST_ENABLED` | Gates `/sentry-test` verification endpoint (Window B) |

### AI service architecture (6 features in Phase 3)

- Bundle shape: `{classifier, explainer, feature_names, feature_groups, version}`
- Synthetic data generation lives in `apps/ai-service/services/*_training.py`
- `CalibratedClassifierCV` wraps the base estimator for probability outputs
- Direction-aware confidence bands — pattern established in commit `2695839` (FAQ)

### Schema-mismatch warning

Agents spawning model-call payloads sometimes wrap fields in `{"features": {...}}` while the api sends flat fields. Always pin payload shape in the spawn prompt — schema drift between agent assumptions and live api is the most common Phase 3 regression.

### WSL DrvFs quirks

- `tsx watch` is flaky on DrvFs mounts — fall back to `pnpm build && node dist` when reloads stop firing
- Bash `!` history expansion mangles JS like `if (!doc)` in inline `-c` strings — use heredocs (`bash <<'EOF' ... EOF`)

### Production verification rituals

- All AI endpoints return `401` when called without auth — easy smoke check
- `GET /health` returns `200` and includes a `"models"` map on ai-service
- Redis match-feed cache must be busted manually after data fixes:
  ```bash
  redis-cli -u $REDIS_URL DEL match_feed:{userId}
  ```

---

## Phase 1 — Active Modules

- [ ] Infrastructure & monorepo setup
- [ ] PostgreSQL schema (Drizzle) + MongoDB connection
- [ ] Authentication (Better Auth · OTP · session cookie · 6 roles)
- [ ] KYC module (Aadhaar · photo fraud detection · duplicate detection)
- [ ] Profile module (personal · family · lifestyle · horoscope · Safety Mode)
- [ ] Community Match Zones
- [ ] Reciprocal Matching engine
- [ ] Guna Milan compatibility scorer (all 8 Ashtakoot factors)
- [ ] Match requests + privacy controls
- [ ] Real-time chat (Socket.io · Hindi–English translation)
- [ ] Vendor discovery (listing · portfolio · category search)
- [ ] Booking system (request → confirm → schedule → complete)
- [ ] Payments (Razorpay · UPI · invoices · refunds)
- [ ] Customer, Vendor, and Admin dashboards
- [ ] CI/CD pipeline (GitHub Actions → Vercel + Railway)

---

## UI Design System

All frontend work follows the Smart Shaadi design system. Do NOT deviate.

```
Primary:    #7B2D42 (Royal Burgundy) — headings, primary CTAs, brand marks
Accent:     #0E7C7B (Peacock Teal)   — secondary CTAs, links, info badges
Gold:       #C5A47E (Warm Gold)      — accents, dividers, premium / featured
Gold-muted: #7A5F3A                  — secondary text on ivory (WCAG-AA)
Success:    #059669 (green)          — verified, paid, completed
Warning:    #D97706 (amber)          — pending KYC, deposit due
Destructive:#DC2626                  — errors, refunds, blocks
Background: #FEFAF6 (Warm Ivory)     — page background
Surface:    #FFFFFF                  — card lift
Text:       #2E2E38 / #6B6B76 (muted)

Heading font: Playfair Display (next/font/google, --font-heading, weight 500/600/700)
Body font:    system-ui, -apple-system, "Segoe UI", sans-serif (--font-body) — fast on low-end Android, no extra payload
Hindi font:   Noto Serif Devanagari (--font-hindi, loaded but unused — bilingual ready)

Cards:         rounded-xl, shadow-card token, p-4 sm:p-6
Buttons:       rounded-lg, h-11 default (44px touch target)
Badges:        rounded-full
Touch targets: min 44×44px
Mobile-first:  everything works at 360px width (Indian Android median)

All colors live as Tailwind v4 @theme tokens in apps/web/src/app/globals.css.
Use bg-primary / text-teal / border-gold / bg-background / text-gold-muted —
never raw hex, never bg-white / bg-gray-* / text-blue-*.
Shadows: shadow-card, shadow-card-hover, shadow-gold-glow (warm-toned tokens).
```

**UI workflow for every component:**
1. Use `/ui-component` slash command — never jump straight to JSX
2. Server Components by default — only `.client.tsx` if it needs hooks or browser APIs
3. shadcn/ui primitives for base components
4. 21st.dev `/ui` command for complex interactive patterns
5. Quality check: loading state? empty state? error state? mobile layout?

---

## Claude Code Power Rules (for this project)

1. **Always use Plan Mode (`Shift+Tab`) before implementing any module** — no exceptions
2. **Research the codebase before planning** — `"Read all files in /apps/api/modules/[area] before planning"`
3. **Run `/compact` every 60 minutes** — context degradation is invisible and kills output quality
4. **Git checkpoint before risky operations** — `git add -A && git commit -m 'checkpoint'`
5. **Use subagents for parallel work** — tests + docs + types can all generate simultaneously
6. **Never exceed PR-sized chunks** — 500–1000 lines max per session
7. **Use `/new-module` slash command** for consistency across all module builds
8. **Sonnet for 95% of tasks, Opus only for complex architecture decisions**
9. **Update this file** when stack or architecture changes
10. **Update ROADMAP.md** at the end of every session
11. **WSL Agent Teams: never use plan approval mode** — teammates block indefinitely waiting for approval signal that never arrives. Each teammate plans in first message then implements immediately.
