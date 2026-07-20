# Week 3 — Matching Engine + Guna Milan: Agent Teams Plan
# VivahOS Infinity · Phase 1 · Days 11–15
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1 + 2)

> **How to use this plan:**
> Phase 0 runs in a single Claude Code session — shared schema/types only.
> Commit after Phase 0 before spawning any teammates.
> Phase 1 and Phase 2 are the Agent Team zones — paste the team prompt verbatim into Claude Code.

---

## Morning Checklist (7:00–8:00) — Before Any Code

```bash
# 1. Read current status
cat CLAUDE.md | head -30

# 2. Confirm week target
grep -A5 "Week 3" ROADMAP.md

# 3. Update CLAUDE.md status block
# Phase: 1 | Week: 3 | Focus: Matching Engine + Guna Milan | Status: Starting

# 4. Start infrastructure
docker compose up -d

# 5. Start all services
pnpm dev

# 6. Enable Agent Teams (already in settings.json after yesterday's config update)
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # should print 1
```

---

## ─── PHASE 0: Single Agent Session (8:00–9:30) ───────────────────────────

> Run this ALONE. No teammates. Commit before proceeding to Phase 1.
> Purpose: shared contracts that all three teammates will import.

### Research prompt (8:00–8:30)

```
Read all of these files and summarise what exists before proposing anything:
- packages/db/schema/index.ts  (look for match_requests, match_scores tables)
- packages/types/src/index.ts
- packages/schemas/src/index.ts
- apps/api/src/index.ts        (existing routers mounted)
- ROADMAP.md Week 3 section
- ARCHITECTURE.md Reciprocal Matching Algorithm section

Do NOT write any code. Summarise what already exists, then list
every file that needs to change in Phase 0 only.
```

### Phase 0 implementation (8:30–9:30)

**Files to create/modify in this single-agent session:**

#### 1. `packages/types/src/matching.ts` — NEW
```typescript
// Paste this to Claude Code after research confirms it doesn't exist

export const MatchStatus = {
  PENDING:   'PENDING',
  ACCEPTED:  'ACCEPTED',
  DECLINED:  'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  BLOCKED:   'BLOCKED',
} as const;
export type MatchStatus = typeof MatchStatus[keyof typeof MatchStatus];

export interface CompatibilityBreakdown {
  demographicAlignment: { score: number; max: 25 }
  lifestyleCompatibility: { score: number; max: 20 }
  careerEducation: { score: number; max: 15 }
  familyValues: { score: number; max: 20 }
  preferenceOverlap: { score: number; max: 20 }
}

export interface GunaBreakdown {
  varna:       { score: number; max: 1;  compatible: boolean }
  vashya:      { score: number; max: 2;  compatible: boolean }
  tara:        { score: number; max: 3;  compatible: boolean }
  yoni:        { score: number; max: 4;  compatible: boolean }
  grahaMaitri: { score: number; max: 5;  compatible: boolean }
  gana:        { score: number; max: 6;  compatible: boolean }
  bhakoot:     { score: number; max: 7;  compatible: boolean }
  nadi:        { score: number; max: 8;  compatible: boolean }
}

export interface GunaResult {
  totalScore:          number   // 0–36
  maxScore:            36
  percentage:          number
  factors:             GunaBreakdown
  mangalDoshaConflict: boolean
  interpretation:      'Excellent match' | 'Good match' | 'Average match' | 'Not recommended'
  recommendation:      string
}

export interface CompatibilityScore {
  totalScore:   number   // 0–100
  breakdown:    CompatibilityBreakdown
  gunaScore:    number   // 0–36, from GunaResult
  tier:         'excellent' | 'good' | 'average' | 'low'
  flags:        string[]
}

export interface MatchFeedItem {
  profileId:     string
  name:          string
  age:           number
  city:          string
  compatibility: CompatibilityScore
  photoKey:      string | null
  isNew:         boolean
}
```

#### 2. `packages/schemas/src/matching.ts` — NEW
```typescript
// Zod schemas for matchmaking endpoints

import { z } from 'zod'

export const MatchRequestSchema = z.object({
  receiverId: z.string().uuid(),
  message:    z.string().max(500).optional(),
})

export const MatchFeedQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export const CompatibilityScoreQuerySchema = z.object({
  profileId: z.string().uuid(),
})

export const GunaInputSchema = z.object({
  profileA: z.object({
    rashi:     z.string(),
    nakshatra: z.string(),
    manglik:   z.boolean(),
  }),
  profileB: z.object({
    rashi:     z.string(),
    nakshatra: z.string(),
    manglik:   z.boolean(),
  }),
})

export type MatchRequestInput         = z.infer<typeof MatchRequestSchema>
export type MatchFeedQuery            = z.infer<typeof MatchFeedQuerySchema>
export type CompatibilityScoreQuery   = z.infer<typeof CompatibilityScoreQuerySchema>
export type GunaInput                 = z.infer<typeof GunaInputSchema>
```

#### 3. Barrel exports — MODIFY
```
packages/types/src/index.ts    → add: export * from './matching.js'
packages/schemas/src/index.ts  → add: export * from './matching.js'
```

#### 4. Verify `match_scores` + `match_requests` tables exist in schema
```bash
grep -n "match_scores\|match_requests\|matchRequests\|matchScores" packages/db/schema/index.ts
```
If missing — add them now. Do not proceed to Phase 1 without these tables in the DB.

### Phase 0 commit (9:30)

```bash
pnpm type-check                         # must be zero errors
pnpm --filter @vivah/types build
pnpm --filter @vivah/schemas build
git add -A
git commit -m "feat(types,schemas): add matching + guna milan shared contracts"
git push origin main
```

> ✅ STOP. Do not write any matching logic yet. Agent Team takes it from here.

---

## ─── PHASE 1: Agent Team — Core Build (9:30–12:30) ──────────────────────

> Paste this prompt verbatim into Claude Code after Phase 0 commit.

### Team spawn prompt

```
We are building Week 3 of VivahOS Infinity — the matching engine and Guna Milan
calculator. Phase 0 is complete and committed: shared types and Zod schemas exist
in packages/types/src/matching.ts and packages/schemas/src/matching.ts.

Create an agent team with exactly 3 teammates. Each teammate owns one domain
with zero file overlap. Require plan approval from each teammate before they
write any implementation code.

Quality bar for all teammates:
- TypeScript strict — no any, no shortcuts
- Every function has a typed return value
- Tests written before implementation (TDD)
- API envelope: { success, data, error, meta } always
- All DB queries filtered by userId — multi-tenant safety non-negotiable
- pnpm type-check must pass before marking any task complete

─── TEAMMATE 1: guna-milan ───────────────────────────────────────────────────
Domain: apps/ai-service/services/guna_milan.py + tests
Files you OWN (no other teammate touches these):
  - apps/ai-service/services/guna_milan.py        (CREATE)
  - apps/ai-service/routers/horoscope.py          (CREATE)
  - apps/ai-service/schemas/horoscope.py          (CREATE)
  - apps/ai-service/tests/test_guna_milan.py      (CREATE)

Your tasks in order:
1. Read prompts/guna-milan-v1.md — this is your spec. Read it fully before planning.
2. Read ARCHITECTURE.md Guna Milan section (the 8-factor table).
3. Implement guna_milan.py as pure deterministic Python — NO LLM calls.
   All 8 Ashtakoot factors with lookup tables:
   Varna(1) Vashya(2) Tara(3) Yoni(4) GrahaMaitri(5) Gana(6) Bhakoot(7) Nadi(8)
   Mangal Dosha detection separate from the 36-point score.
4. Write test_guna_milan.py with pytest BEFORE implementing each factor.
   Required test cases:
   - Perfect score (36/36) — known compatible pair
   - Zero score (0/36) — known incompatible pair  
   - Mangal Dosha conflict (one manglik, one not)
   - Mangal Dosha cancelled (both manglik)
   - Missing nakshatra data → graceful fallback, not crash
   - All 27 Nakshatras cycle through without KeyError
5. Create horoscope.py FastAPI router: POST /ai/horoscope/guna
   Input: GunaInput schema (rashi, nakshatra, manglik for both profiles)
   Output: GunaResult schema matching packages/types/src/matching.ts exactly
6. Run: pytest apps/ai-service/tests/test_guna_milan.py -v
   All tests must pass. 100% coverage on guna_milan.py required.

─── TEAMMATE 2: matching-engine ──────────────────────────────────────────────
Domain: apps/api/src/matchmaking/ (service + tests)
Files you OWN (no other teammate touches these):
  - apps/api/src/matchmaking/engine.ts            (CREATE)
  - apps/api/src/matchmaking/filters.ts           (CREATE)
  - apps/api/src/matchmaking/scorer.ts            (CREATE)
  - apps/api/src/matchmaking/__tests__/engine.test.ts  (CREATE)
  - apps/api/src/matchmaking/__tests__/filters.test.ts (CREATE)

Your tasks in order:
1. Read ARCHITECTURE.md Reciprocal Matching Algorithm section fully.
2. Read packages/db/schema/index.ts — understand match_scores, match_requests,
   profiles tables before writing a single query.
3. Implement filters.ts — hard filter application:
   - Age range bilateral check (A's prefs vs B's profile AND B's prefs vs A's profile)
   - Religion filter (respect openToInterfaith flag)
   - Location radius filter (city/state level — no GPS needed yet)
   - Income range bilateral check
   Rule: if EITHER side fails the other's filters → REMOVE the candidate.
4. Write filters.test.ts BEFORE implementing. Test cases:
   - Candidate removed when A fails B's age filter (bilateral)
   - Candidate removed when B fails A's religion filter
   - Candidate passes when both sides meet each other's filters
   - openToInterfaith=true overrides religion filter correctly
5. Implement scorer.ts — weighted compatibility scoring (0–100):
   demographicAlignment: 25%
   lifestyleCompatibility: 20%
   careerEducation: 15%
   familyValues: 20%
   preferenceOverlap: 15%
   gunaScore (normalised from 0–36 to 0–5%): 5%
   NOTE: gunaScore comes from Redis cache key match_scores:{profileA}:{profileB}
   If not cached → use 18/36 (neutral) as fallback, flag for async recalc.
6. Implement engine.ts — orchestrates filters + scorer:
   - applyHardFilters(userId, candidates[]) → filtered candidates
   - scoreAndRank(userId, filtered[]) → sorted MatchFeedItem[]
   - getCachedFeed(userId) → Redis lookup, null if miss
   - computeAndCacheFeed(userId) → full pipeline, cache result TTL 24h
7. Write engine.test.ts — mock DB and Redis, test the pipeline end to end.
8. Run: pnpm --filter @vivah/api test
   All tests must pass. Zero TypeScript errors.

─── TEAMMATE 3: match-api ────────────────────────────────────────────────────
Domain: apps/api/src/matchmaking/router.ts + apps/web match feed page
Files you OWN (no other teammate touches these):
  - apps/api/src/matchmaking/router.ts            (CREATE)
  - apps/api/src/index.ts                         (MODIFY — mount router only)
  - apps/web/src/app/(matchmaking)/feed/page.tsx  (CREATE)
  - apps/web/src/app/(matchmaking)/feed/loading.tsx (CREATE)

WAIT: Do not start until Teammate 2 signals engine.ts is complete.
Check the task list before beginning router.ts implementation.

Your tasks in order:
1. Read docs/API.md matchmaking section — these are your endpoint specs.
2. Read apps/api/src/auth/middleware.ts — understand authenticate() and authorize().
3. Read apps/api/src/lib/response.ts — understand ok() and err() helpers.
4. Implement router.ts with these endpoints:
   GET  /api/v1/matchmaking/feed          → getCachedFeed or computeAndCacheFeed
   GET  /api/v1/matchmaking/score/:profileId → single compatibility score
   POST /api/v1/matchmaking/requests      → send match request
   PUT  /api/v1/matchmaking/requests/:id  → accept or decline
   All endpoints: authenticate() middleware, Zod validation, typed response envelope.
5. Mount router in apps/api/src/index.ts:
   app.use('/api/v1/matchmaking', matchmakingRouter)
6. Build apps/web/src/app/(matchmaking)/feed/page.tsx:
   - Server Component (no 'use client')
   - Fetch from /api/v1/matchmaking/feed via server-side fetch
   - Render match cards using VivahOS design system:
     Primary: #7B2D42 Royal Burgundy
     CTA/teal: #0E7C7B Peacock Teal  
     Gold:     #C5A47E Warm Gold
     Background: #FEFAF6 Warm Ivory
   - Each card: photo, name, age, city, compatibility score badge (teal)
   - Guna score shown as n/36 in gold
   - Empty state: "No matches yet — complete your profile"
   - loading.tsx: skeleton cards matching the card layout
7. Run: pnpm type-check from monorepo root. Zero errors before marking done.

─── SHARED RULES FOR ALL TEAMMATES ──────────────────────────────────────────
- Git checkpoint before any file write: git add -A && git commit -m "checkpoint: [name]"
- Never touch a file owned by another teammate
- When blocked by another teammate's output → update task status to BLOCKED
  and message that teammate directly via the task list
- /compact when your context hits 70% — do not wait for autocompact
- Signal task complete in the shared task list before going idle
```

---

## ─── PHASE 2: Agent Team — Integration + Tests (13:00–16:00) ────────────

> After lunch. Teammates continue or new tasks assigned based on Phase 1 state.
> Check task list first: which tasks are complete, which are blocked.

### Phase 2 team prompt (paste after checking task list)

```
Phase 1 build is complete (or in progress). Now move to integration and hardening.

Assign these tasks based on current task list state:

TASK: guna-integration (assign to guna-milan teammate)
- Wire apps/api/src/matchmaking/scorer.ts to call POST /ai/horoscope/guna
  via apps/api/src/lib/ai.ts (internal AI service client)
- If AI service is down → graceful fallback to neutral score (18/36)
- Add integration test: mock the AI service HTTP call, verify scorer uses result

TASK: feed-cache-warmup (assign to matching-engine teammate)  
- Create apps/api/src/jobs/matchFeedJob.ts
  Bull queue job: queue:match-compute
  Nightly at 2AM: recompute feeds for all active users
  Batch size: 50 users per job to avoid memory spikes
- Add to Bull queue setup in apps/api/src/infrastructure/redis/

TASK: e2e-smoke (assign to match-api teammate)
- Manual smoke test checklist (run against local dev):
  1. GET /api/v1/matchmaking/feed with valid JWT → 200, returns MatchFeedItem[]
  2. GET /api/v1/matchmaking/feed with no JWT → 401
  3. GET /api/v1/matchmaking/score/:profileId → 200, returns CompatibilityScore
  4. POST /api/v1/matchmaking/requests → 201, match request created
  5. PUT /api/v1/matchmaking/requests/:id (accept) → 200
  6. Web: /feed page loads without error, shows skeleton on slow network
- Document any failures in a file: docs/smoke-test-week3.md
```

---

## ─── Integration & Wrap (16:00–17:30) ──────────────────────────────────

> Single agent takes over. Shut down the team first.

### Shutdown prompt
```
Ask all teammates to shut down gracefully. Then clean up the team.
```

### Final verification (single agent)
```bash
# Full test suite
pnpm test

# Type check all workspaces
pnpm type-check

# Lint
pnpm lint

# Python tests
cd apps/ai-service
source venv/bin/activate
pytest tests/test_guna_milan.py -v --tb=short
cd ../..

# Check API endpoints are mounted
grep -n "matchmaking" apps/api/src/index.ts

# Verify Redis keys pattern is correct
grep -rn "match_feed\|match_scores" apps/api/src/
```

---

## ─── Session End (17:30–18:00) ─────────────────────────────────────────

```bash
# Update ROADMAP.md — mark Week 3 items complete
# Update CLAUDE.md status block:
# Phase: 1 | Week: 4 | Focus: Match Requests + Chat | Status: Starting

git add -A
git commit -m "feat(matchmaking): guna milan calculator + reciprocal engine + match feed"
git push origin main

# Verify deploys
# Vercel preview: check /feed page loads
# Railway: check /ai/horoscope/guna endpoint responds
```

---

## File Ownership Map (Zero Overlap Enforced)

| File | Owner | Phase |
|------|-------|-------|
| `packages/types/src/matching.ts` | Single agent | Phase 0 |
| `packages/schemas/src/matching.ts` | Single agent | Phase 0 |
| `apps/ai-service/services/guna_milan.py` | Teammate 1 | Phase 1 |
| `apps/ai-service/routers/horoscope.py` | Teammate 1 | Phase 1 |
| `apps/ai-service/schemas/horoscope.py` | Teammate 1 | Phase 1 |
| `apps/ai-service/tests/test_guna_milan.py` | Teammate 1 | Phase 1 |
| `apps/api/src/matchmaking/engine.ts` | Teammate 2 | Phase 1 |
| `apps/api/src/matchmaking/filters.ts` | Teammate 2 | Phase 1 |
| `apps/api/src/matchmaking/scorer.ts` | Teammate 2 | Phase 1 |
| `apps/api/src/matchmaking/__tests__/` | Teammate 2 | Phase 1 |
| `apps/api/src/matchmaking/router.ts` | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Teammate 3 | Phase 1 (mount only) |
| `apps/web/src/app/(matchmaking)/feed/` | Teammate 3 | Phase 1 |
| `apps/api/src/jobs/matchFeedJob.ts` | Teammate 2 | Phase 2 |

---

## Dependency Chain (Blocking Order)

```
Phase 0 (single agent)
  └── packages/types + packages/schemas committed
        ├── Teammate 1 (independent — starts immediately)
        ├── Teammate 2 (independent — starts immediately)
        └── Teammate 3 (BLOCKED until Teammate 2 engine.ts complete)
              └── Phase 2 integration tasks (all teammates)
```

---

## Test Coverage Requirements

| Module | Required Coverage | Non-Negotiable Cases |
|--------|------------------|----------------------|
| `guna_milan.py` | 100% | 0/36, 36/36, Mangal Dosha, missing nakshatra |
| `filters.ts` | 90%+ | Bilateral check, openToInterfaith override |
| `scorer.ts` | 85%+ | All 5 weight dimensions, guna fallback |
| `engine.ts` | 85%+ | Cache hit, cache miss, empty result |
| `router.ts` | Integration | Auth, validation, envelope shape |

---

## Blockers to Watch

```
[Watch] Guna Milan lookup tables — nakshatra-to-nadi mapping has known
        ambiguities in different Vedic traditions. Use North Indian system
        (most common in your target market). Document the choice in a comment.

[Watch] Teammate 3 depends on Teammate 2 — if engine.ts takes longer than
        expected, redirect Teammate 3 to build the feed page UI first
        (mock data), then wire it to the real API when Teammate 2 is done.

[Watch] apps/api/src/index.ts is touched by Teammate 3 only for mounting.
        Single agent must not touch this file during Phase 1.
```
