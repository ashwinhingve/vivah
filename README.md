# Smart Shaadi

**National Smart Marriage-Centric Event Ecosystem**

> AI-driven matchmaking · Wedding & event planning · Vendor marketplace · Financial services · National infrastructure

---

## What This Is

Smart Shaadi is a full-lifecycle digital platform that manages the complete marriage journey — from the moment a person begins searching for a life partner to the last payment made after the wedding reception. It is not a matrimonial website. It is a **Marriage Operating System** that connects individuals, families, vendors, and financial institutions into a single, technology-enabled national infrastructure.

**The core cycle:**
```
Matchmaking → Marriage → Events → Vendor Utilization → Continuous Revenue
```

---

## Monorepo Structure

```
smart-shaadi/
├── apps/
│   ├── web/                     # Next.js 15 App Router (web frontend)
│   ├── api/                     # Node.js + TypeScript (core REST API)
│   ├── ai-service/              # Python + FastAPI (ML scoring, AI features)
│   └── mobile/                  # React Native + Expo (iOS & Android)
├── packages/
│   ├── types/                   # Shared TypeScript types
│   ├── schemas/                 # Shared Zod validation schemas
│   ├── db/                      # Drizzle ORM schema + migrations
│   └── config/                  # Shared ESLint, TS, Tailwind config
├── .claude/
│   └── commands/                # Custom Claude Code slash commands
├── docs/                        # Architecture, API, database docs
├── prompts/                     # Versioned AI prompt files
├── infrastructure/              # Docker Compose, env templates
├── CLAUDE.md                    # ← Claude Code reads this at session start
├── ROADMAP.md                   # ← Living phase tracker
└── ARCHITECTURE.md              # ← Full system architecture
```

---

## Quick Start

```bash
# Prerequisites: Node.js 20+, Python 3.11+, Docker, pnpm

# Install all dependencies
pnpm install

# Copy environment files
cp infrastructure/.env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/ai-service/.env.example apps/ai-service/.env

# Start local infrastructure (PostgreSQL, MongoDB, Redis)
docker compose up -d

# Run database migrations
pnpm db:push

# Seed development data
pnpm db:seed

# Start all services in parallel (Turborepo)
pnpm dev
```

**Services after `pnpm dev`:**

| Service | URL |
|---------|-----|
| Web (Next.js) | http://localhost:3000 |
| API (Node.js) | http://localhost:4000 |
| AI Service (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| DB Browser (Adminer) | http://localhost:8080 |

---

## Commands

```bash
pnpm dev              # Start all services (Turborepo parallel)
pnpm build            # Build all apps for production
pnpm test             # Run Vitest unit tests
pnpm e2e              # Run Playwright end-to-end tests
pnpm type-check       # TypeScript strict check across all apps
pnpm lint             # ESLint across monorepo
pnpm db:push          # Push Drizzle schema changes to database
pnpm db:generate      # Generate new migration files
pnpm db:seed          # Seed development database with test data
pnpm db:studio        # Open Drizzle Studio (visual DB browser)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web Frontend** | Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui |
| **Mobile** | React Native 0.78 · Expo SDK 55 · Expo Router v4 · NativeWind |
| **Core API** | Node.js · Express · TypeScript · Drizzle ORM |
| **AI Service** | Python 3.11 · FastAPI · Scikit-learn · HuggingFace Transformers · PyTorch |
| **Databases** | PostgreSQL (relational) · MongoDB Atlas (profiles/content) · Redis (cache/queues) |
| **Real-Time** | Socket.io (chat) · Redis pub/sub (notifications) |
| **Auth** | Better Auth · Phone OTP · JWT (15m access + 30d refresh) |
| **Payments** | Razorpay (UPI, cards, wallets, subscriptions) |
| **Storage** | Cloudflare R2 (S3-compatible, zero egress) |
| **Email** | AWS SES |
| **SMS/OTP** | MSG91 (DLT-registered) |
| **Push** | Firebase FCM |
| **AI/LLM** | Anthropic Claude API · Vercel AI SDK v6 · Mastra agents |
| **Hosting** | Railway (API + AI service) · Vercel (Next.js) |
| **Monitoring** | Sentry (errors) · PostHog (analytics) · Helicone (LLM costs) · BetterStack (uptime) |
| **CI/CD** | GitHub Actions → Railway/Vercel auto-deploy |

---

## Delivery Plan

### Core Platform — 3 Months (Phases 1–4)

| Phase | Timeline | Focus | Milestone |
|-------|----------|-------|-----------|
| **Phase 1** | Weeks 1–5 | Auth · KYC · Profiles · Reciprocal Matching · Guna Milan · Chat · Vendor · Booking · Payments | Platform live, first revenue |
| **Phase 2** | Weeks 6–9 | Wedding Planner · Guest Mgmt · Video Calls · Escrow · Rentals · Multi-Event | Full planning suite |
| **Phase 3** | Weeks 10–11 | AI Coach · Emotional Score · Profile Optimizer · Behaviour Matching · Churn Detection | AI-powered, self-improving |
| **Phase 4** | Weeks 12–13 | Subscriptions · Hindi · Auto-SEO · Dynamic Pricing · Referral · Analytics | Market-ready, monetised |

### Expansion Plan — 3 Months (Phases 5–8)

| Phase | Timeline | Focus | Milestone |
|-------|----------|-------|-----------|
| **Phase 5** | Weeks 1–4 | Vendor Utilization Engine · Calendar Intelligence · Documentation | Vendors earn year-round |
| **Phase 6** | Weeks 5–8 | Financial Services (NBFC) · Auto-Marketing · Multi-city | 8 revenue streams |
| **Phase 7** | Weeks 9–11 | Mobile App · NRI Matching · Virtual Dates | Global-ready mobile |
| **Phase 8** | Weeks 12–13 | Destination Weddings · National Infrastructure | Complete national platform |

---

## User Roles

| Role | Access |
|------|--------|
| `INDIVIDUAL` | Full matchmaking, profile, chat, booking |
| `FAMILY_MEMBER` | Wedding plan access, task management |
| `VENDOR` | Service listing, booking management, revenue tracking |
| `EVENT_COORDINATOR` | Multi-event booking, logistics coordination |
| `ADMIN` | Full platform management, vendor approval |
| `SUPPORT` | Complaint resolution, user management |

---

## Revenue Streams

1. Matchmaking subscriptions (Free / Standard / Premium)
2. Vendor booking commission (% per confirmed booking)
3. Vendor lead generation fee (per qualified inquiry)
4. NBFC loan referral commission
5. Wedding insurance referral commission
6. Advertising and featured vendor listings
7. Rental service fees
8. B2B / institutional event bookings

---

## Key Differentiators

- **Reciprocal Matching** — profiles surface only where both parties are algorithmically compatible
- **Vendor Utilization Engine** — keeps vendors booked year-round, not just wedding season
- **6 AI Matchmaking Features** — Conversation Coach, Emotional Score, Profile Optimizer, Marriage Readiness, Family Compatibility, Reputation Score
- **Calendar Intelligence** — muhurat-aware scheduling and demand-based dynamic pricing
- **Safety Mode** — contact details hidden until both parties choose to share
- **Auto-SEO** — LLM-generated community × city landing pages driving organic traffic

---

## Documentation Index

| File | Purpose |
|------|---------|
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code context — read this first, update it often |
| [`ROADMAP.md`](./ROADMAP.md) | Live phase tracker — mark tasks done daily |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Full system architecture and design decisions |
| [`docs/SETUP.md`](./docs/SETUP.md) | Local development environment setup |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Database schema and data model |
| [`docs/API.md`](./docs/API.md) | API design guide and endpoint reference |

---

## Developer

**Ashwin Hingve** — sole development execution owner

*Client: Colonel Deepak · Strategic Support: Marksman Team*
# vivah
