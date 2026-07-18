# Handover Index

> Phase 8 Sprint H (Unit 8.3). Entry point for anyone taking over operation of
> Smart Shaadi. Start here.

Smart Shaadi has been built and is launch-ready, but **has not yet carried production
traffic**. The three launch blockers are all on the Colonel's side: Razorpay registration,
MSG91 DLT sender approval, and legal sign-off. Everything technical is waiting on those.

That fact colours this whole document set: capacity numbers, SLO targets and index choices
are reasoned estimates, and each document says so where it matters. The first real traffic
is what turns them into knowledge.

## Read in this order

### 1. Understand the system
- **`../ARCHITECTURE.md`** — modular monolith, layer boundaries, monolith→services path
- **`../../CLAUDE.md`** — project context and the 12 non-negotiable architecture rules.
  Rules 11 (Mongo mock guards) and 12 (`userId` ≠ `profileId` ≠ `vendorId`) cause the most
  bugs; read those twice
- **`../adr/`** — ADR-001 pricing model, ADR-002 cross-origin cookies/CORS

### 2. Run it
- **`ENV-MATRIX.md`** — every environment variable, the mock/live system, and the
  **go-live checklist**. Read before touching any config
- **`../PROVIDER-ACTIVATION/`** — 15 per-provider setup guides (Razorpay, MSG91, R2,
  Daily.co, DigiLocker, Sentry, SES, …)
- **`../phase-5-8/NATIVE-SETUP-AND-ENV.md`** — local dev setup

### 3. Operate it
- **`../RUNBOOK.md`** — incident playbooks: webhook flood, escrow stuck, Mongo down,
  ai-service down, Redis down
- **`SLO-AND-ALERTING.md`** — SLIs, proposed SLOs, what pages vs what warns
- **`SCALING-PLAYBOOK.md`** — capacity model, the first bottleneck, what to change in
  what order
- **`../monitoring/betterstack-setup.md`** — monitor wiring

### 4. Change it safely
- **`INDEX-PLAN.md`** — analytics index rationale and how to re-verify on real data
- **`../../CLAUDE.md`** → "Production DB Migration Protocol" — **read before any schema
  change.** `drizzle-kit push` is unusable against production (the 42P16 Better Auth PK
  hazard); migrations go through the Railway SQL console
- **`../db/journal-drift.md`** — migration journal drift notes

## Things that will surprise you

Hard-won and easy to trip over:

1. **`drizzle-kit push` cannot be run against production.** It crashes on the Better Auth
   text-id primary keys (error 42P16) before showing a plan. Use the Railway Data → Query
   console. Do not retry the push.
2. **`userId`, `profileId` and `vendorId` are three different values.** Passing a Better
   Auth `userId` to a profile-keyed column silently produces 403s on every request rather
   than an obvious error. CLAUDE.md rule 12.
3. **Mock mode is the default posture, including in production.** `USE_MOCK_SERVICES=true`
   with per-service `*_LIVE` escape hatches, so R2/Mongo/video are real today while
   Razorpay/MSG91 are not. See `ENV-MATRIX.md`.
4. **Any Mongo call must be guarded by the mock check.** `connectMongo()` skips connecting
   in mock mode, so an unguarded Mongoose call buffers for 10s and then crashes.
   CLAUDE.md rule 11.
5. **PDF generators must render `Rs.`, never the `₹` glyph.** PDFKit's Helvetica renders
   the rupee sign wrong. `apps/api/src/lib/pdf/format.ts` centralises this.
6. **Type-check and build passing does not mean a Server Component works.** They compile
   fine and still throw at request time. Open the page. CLAUDE.md "Verification Protocol".
7. **WSL2 vs Windows split.** `psql` reaches Railway from WSL2, but `drizzle-kit
   push`/`studio` must run from native Windows PowerShell. `pg_dump` here is 16.14 and too
   old to dump PG 18.3.

## Where the code lives

```
apps/web/          Next.js 15 App Router — frontend + Server Actions
apps/api/          Express + TypeScript — the core REST API
apps/ai-service/   Python/FastAPI — ML scoring, matchmaking, fraud
apps/mobile/       React Native + Expo (Unit 7.1 scaffold)
packages/types/    Shared TypeScript contracts
packages/schemas/  Shared Zod schemas
packages/db/       Drizzle schema + migrations
perf/              k6 load scripts (no baseline recorded yet)
```

## Build status

Phases 1–7 are shipped. Remaining roadmap work and why it is not built:

| Unit | Status |
|---|---|
| 6.4 Auto-marketing | Blocked — needs real conversion data; building it blind would be guesswork |
| 6.5 Multi-city vendor network | Blocked — needs vendor density in more than one city |
| 8.1 Destination weddings | UX buildable; live supply is business development |
| 8.2 Post-marriage services | Blocked — partner agreements |

`docs/phase-5-8/PHASE-5-8-ROADMAP.md` has the full unit-by-unit history.

## First tasks for a new owner

1. Work through the go-live checklist in `ENV-MATRIX.md`.
2. Record a k6 baseline against staging and write it into `perf/README.md` — nothing else
   here can be calibrated without it.
3. After a week of real traffic, replace the proposed targets in `SLO-AND-ALERTING.md`
   with measured percentiles, and re-check the indexes with the `pg_stat_user_indexes`
   queries in `INDEX-PLAN.md`.
