# Smart Shaadi — Claude Code Context

> **Read this before every session. Update the Current Status block every morning.**
> This file is auto-read by Claude Code at session start.

---

## Project Identity
- **Name:** Smart Shaadi — National Smart Marriage-Centric Event Ecosystem
- **Client:** Colonel Deepak | **Developer:** Ashwin Hingve (sole executor)
- **Agreement:** 05 April 2026 | **Path:** `D:\Do Not Open\vivah\smartShaadi`
- **Stack:** TypeScript end-to-end · Node.js API · Python AI service · Next.js web

---

## Current Status
```
Phase:    1
Week:     [UPDATE DAILY]
Focus:    [UPDATE DAILY — e.g. "Building Reciprocal Matching Engine"]
Done today: [UPDATE DAILY — e.g. "Auth complete, KYC mock done"]
Mocks:    USE_MOCK_SERVICES=true (OTP · KYC · Payments — client registering company)
Blocker:  [None / describe blocker]
```

---

## Repository Structure
```
apps/web/          → Next.js 15 App Router (frontend + Server Actions)
apps/api/          → Node.js/Express/TypeScript (core REST API)
apps/ai-service/   → Python/FastAPI (ML, AI matchmaking, fraud)
apps/mobile/       → React Native 0.78 + Expo SDK 55 (Phase 7 only)
packages/types/    → Shared TypeScript types
packages/schemas/  → Shared Zod validation schemas
packages/db/       → Drizzle ORM schema + migrations (PostgreSQL)
prompts/           → Versioned AI prompt files
docs/              → Architecture, API, database docs
.claude/commands/  → Slash commands
```

---

## Commands
```bash
pnpm dev            # Start all services (Turborepo parallel)
pnpm test           # Run Vitest unit tests
pnpm test --watch   # Watch mode
pnpm e2e            # Playwright E2E tests
pnpm type-check     # TypeScript strict check across all packages
pnpm lint           # ESLint across monorepo
pnpm db:push        # Push Drizzle schema to PostgreSQL (dev only)
pnpm db:generate    # Generate migration files
pnpm db:seed        # Seed dev database
pnpm db:studio      # Open Drizzle Studio (http://localhost:4983)
```

---

## Full Tech Stack
```
Frontend:    Next.js 15 App Router · TypeScript strict · shadcn/ui · Tailwind v4
Mobile:      React Native 0.78 · Expo SDK 55 · Expo Router v4 · NativeWind (Phase 7)
Core API:    Node.js · Express · TypeScript · Drizzle ORM (PostgreSQL)
AI Service:  Python 3.11 · FastAPI · Scikit-learn · HuggingFace · PyTorch
Databases:   PostgreSQL (Railway) · MongoDB Atlas · Redis (Railway)
Storage:     Cloudflare R2 (pre-signed URLs — never stream through API)
Auth:        Better Auth · Phone OTP · JWT (15m access / 30d refresh)
Payments:    Razorpay (UPI, cards, wallets, EMI, Subscriptions) [MOCKED]
SMS/OTP:     MSG91 DLT [MOCKED — accepts 123456]
Email:       AWS SES
Push:        Firebase FCM
AI/LLM:      Anthropic Claude API via Helicone proxy
Monitoring:  Sentry · PostHog · Helicone · BetterStack
CI/CD:       GitHub Actions → Vercel (web) + Railway (API + AI service)
```

---

## Mock Services Pattern (CRITICAL)
```typescript
// Single ENV switch — zero code rewrite when real credentials arrive
const sendOTP = async (phone: string, otp: string) => {
  if (process.env.USE_MOCK_SERVICES === 'true') {
    console.log(`[MOCK] ${phone}: ${otp}`) // always accepts 123456
    return { success: true }
  }
  return await msg91.sendOTP(phone, otp)
}
// USE_MOCK_SERVICES=true in apps/api/.env
```

---

## Architecture Rules — NEVER Violate
1. All LLM calls → `apps/ai-service/` or `apps/web/lib/ai/index.ts` ONLY
2. All DB queries filtered by `userId` — multi-tenant safety
3. Server Actions for ALL mutations in Next.js — never API routes for CRUD
4. Never `any` in TypeScript — use `unknown` and narrow
5. Phone/email NEVER in API responses — masked until user explicitly unlocks
6. All file uploads → Cloudflare R2 pre-signed URLs — never through API
7. Session data → Redis only — never app memory
8. Background jobs → Bull queues — never sync SMS/email/push
9. Guna Milan → `apps/ai-service/routers/horoscope.py` — deterministic, 100% test coverage
10. Reciprocal Matching → both sides must pass filters before any profile surfaces

---

## Code Conventions
```
Components:   ComponentName.client.tsx (browser) | ComponentName.tsx (server default)
DB queries:   packages/db/ repositories — never inline
AI calls:     apps/ai-service/ (Python) | apps/web/lib/ai/ (TS proxy)
Prompts:      prompts/feature-v1.md — always bump version, never edit in place
API envelope: { success, data, error, meta } — always
Errors:       Always typed — never throw generic Error()
```

---

## Design System — Royal Burgundy · Warm Gold · Peacock Teal
```
Primary brand:   #7B2D42  (Royal Burgundy)  — headings, brand, auspicious elements
Accent gold:     #C5A47E  (Warm Gold)       — badges, decorative borders
CTA / action:    #0E7C7B  (Peacock Teal)    — ALL buttons, verified badges, match scores
Hover Burgundy:  #5C2032  | Hover Teal: #149998  | Gold text: #9E7F5A
Page bg:         #FEFAF6  (Warm Ivory — NEVER plain white for pages)
Card surface:    #FFFFFF  (interior of cards only)
Dark surface:    #2D2D3A  (nav, footer)
Primary text:    #2E2E38  | Secondary text: #6B6B76

Typography:  Playfair Display (headings, serif) + Inter (body)
Cards:       rounded-xl shadow-sm border border-[#C5A47E]/20 p-4
Buttons:     min-h-[44px] rounded-lg — Teal for CTAs, Burgundy for brand actions
Mobile-first: 375px minimum | Touch: 44×44px minimum

RULE: Burgundy = brand/identity. Gold = premium decorative. Teal = every action.
```

---

## UI Component Workflow (Every New Screen)
1. Use `/ui-component` slash command — never jump straight to JSX
2. Server Component by default — `.client.tsx` only if needs hooks/events
3. shadcn/ui primitives as base
4. 21st.dev `/ui` command for complex interactive patterns
5. Before marking done: loading state? empty state? error state? 375px mobile?

---

## Database Overview
```
PostgreSQL (Drizzle ORM):
  users, sessions, otp_verifications
  profiles, profile_photos, community_zones
  match_requests, match_scores, blocked_users
  vendors, vendor_services, vendor_event_types
  bookings, booking_items
  weddings, wedding_tasks, wedding_members, ceremonies
  payments, escrow_accounts, audit_logs (immutable)
  guest_lists, guests, invitations
  products, orders, order_items
  notifications, notification_preferences

MongoDB Atlas (Mongoose):
  profiles_content  → full profile, horoscope, lifestyle, AI embedding
  wedding_plans     → theme, budget, ceremonies, checklist, muhurat dates
  chats             → message history per match pair
  vendor_portfolios → rich media, packages, event types, FAQs

Redis:
  sessions:{userId}       → JWT session (TTL 30d)
  match_feed:{userId}     → top-20 match feed (TTL 24h)
  match_scores:{pair}     → computed score (TTL 7d)
  otp:{phone}:{purpose}   → OTP hash (TTL 10m)
  queue:notifications     → Bull job queue
  queue:escrow-release    → Bull delayed job (48h auto-release)
```

---

## Environment Variables (Required in apps/api/.env)
```bash
DATABASE_URL=postgresql://vivah:vivah@localhost:5432/smart_shaadi
MONGODB_URI=mongodb://vivah:vivah@localhost:27017/smart_shaadi
REDIS_URL=redis://localhost:6379
JWT_SECRET=vivah-dev-secret-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
USE_MOCK_SERVICES=true
MSG91_API_KEY=placeholder
MSG91_SENDER_ID=VIVAH
MSG91_TEMPLATE_ID=placeholder
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=smart-shaadi-dev
ANTHROPIC_API_KEY=sk-ant-xxx
HELICONE_API_KEY=sk-helicone-xxx
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_INTERNAL_KEY=internal-dev-key
PORT=4000
NODE_ENV=development
```

---

## What NOT to Do
- No `use client` unless needs browser APIs or event handlers
- No Next.js API routes for mutations — Server Actions only
- No direct LLM calls from frontend or Server Actions
- No storing Aadhaar numbers or raw KYC data — status only
- No blocking LLM calls in request handlers — Bull queues
- No sensitive data in localStorage — httpOnly cookies
- No skipping tests for: Guna Milan · escrow state machine · Razorpay webhooks

---

## Claude Code Power Rules
1. Plan Mode (Shift+Tab) before every module — no exceptions
2. Research codebase before planning — "Read all files in [area] first"
3. /compact every 60 minutes — non-negotiable
4. Git checkpoint before risky ops: `git add -A && git commit -m 'checkpoint'`
5. Subagents for parallel work — tests + docs + types simultaneously
6. Max 1000 lines per session — break into PR-sized chunks
7. Use slash commands: /new-module /fix-bug /week-end /ai-module /ui-component /db-op
8. Sonnet for 95% of work — Opus only for hard architecture decisions
9. Update this file when stack or architecture changes
10. Update ROADMAP.md at end of every session
