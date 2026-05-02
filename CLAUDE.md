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
Week:      10 → IN PROGRESS
Focus:     Phase 3 — AI Intelligence Layer (next)
Status:    Multi-Event coordinator suite + Polish baseline shipped (2026-05-01)
Mocks:     USE_MOCK_SERVICES=true (swap after company registration)
Last session: 2026-04-22 — Week 9 e-commerce store + Phase 2 QA audit complete
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

## Tech Stack (Full)

```
Frontend:    Next.js 15 App Router · TypeScript strict · shadcn/ui · Tailwind v4
Mobile:      (Phase 7 — React Native 0.78 + Expo SDK 55 + Expo Router v4 + NativeWind, not yet scaffolded)
Core API:    Node.js · Express · TypeScript · Drizzle ORM (PostgreSQL)
AI Service:  Python 3.11 · FastAPI · Scikit-learn · HuggingFace · PyTorch
Databases:   PostgreSQL (Supabase/Railway) · MongoDB Atlas · Redis (Railway)
Storage:     Cloudflare R2 (S3-compatible, no egress fees)
Auth:        Better Auth · Phone OTP · JWT (15m access / 30d refresh)
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
  users, sessions, otp_verifications
  profiles (metadata), profile_photos
  match_requests, match_scores, blocked_users
  vendors, vendor_services, vendor_availability
  bookings, booking_items
  weddings, wedding_tasks, wedding_vendors
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
  sessions:*        → JWT session data
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

## Phase 1 — Active Modules

- [ ] Infrastructure & monorepo setup
- [ ] PostgreSQL schema (Drizzle) + MongoDB connection
- [ ] Authentication (Better Auth · OTP · JWT · 6 roles)
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
Primary:    #0A1F4D (navy)   — headings, key actions
Accent:     #1848C8 (blue)   — interactive elements
Success:    #059669 (green)  — match scores, verified badges
Warning:    #D97706 (amber)  — alerts, question boxes
Background: White / #F8F9FC  — surfaces
Text:       #0F172A / #64748B (muted)

Cards:        rounded-xl, shadow-sm, p-4 or p-5
Buttons:      rounded-lg
Badges:       rounded-full
Touch targets: min 44×44px
Mobile-first: everything works at 375px width
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
