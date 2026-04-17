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
- **Stack:** TypeScript end-to-end · Node.js API · Python AI service · Next.js web · React Native mobile

---

## Current Status

```
Phase:     1
Week:      4 (STARTING)
Focus:     Match Requests + Chat
Status:    Week 3 Complete — advancing to Week 4 (Match Requests + Chat)
Mocks:     USE_MOCK_SERVICES=true
Last session: 2026-04-17
  - Day 10 Final: router.ts — GET /me/photos, POST /me/photos (PhotoUploadSchema with fileSize/mimeType),
    PUT /me/photos/reorder, PUT /me/photos/primary, DELETE /me/photos/:photoId (all via photosService)
  - photos.service.ts: addProfilePhoto (8-limit, auto-primary, section tracking), getProfilePhotos,
    deleteProfilePhoto (promotes next primary), reorderPhotos (transaction), setPrimaryPhoto (transaction)
  - Section completeness weights: personal:20, photos:20, family:15, career:15, lifestyle:10, horoscope:10, preferences:10
  - 102 API tests passing (20 new photo service tests), type-check clean, lint clean
  - All Day 10 deliverables complete: DB schema, Zod schemas, service, router, frontend components,
    profile view luxury redesign, photo onboarding flow (/profile/photos → /profile/complete)
```

> **Update this block at the start of every session.**

---

## Repository Structure

```
apps/web/          → Next.js 15 App Router (frontend + Server Actions)
apps/api/          → Node.js/Express/TypeScript (core REST API)
apps/ai-service/   → Python/FastAPI (ML scoring, AI matchmaking, fraud)
apps/mobile/       → React Native 0.78 + Expo SDK 55 (Phase 7)
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
Mobile:      React Native 0.78 · Expo SDK 55 · Expo Router v4 · NativeWind
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
