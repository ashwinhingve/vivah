# Smart Shaadi — Phase 5–8 Claude Code Prompts (native + parallel)

> Repo lives at **`~/vivahOS`** (native ext4 in WSL). **Git runs from WSL** here
> (the PowerShell-only rule was a `/mnt/d` DrvFs workaround — gone). Agent teams
> enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).
> Every sprint = **Phase 0 (single) → Phase 1 (parallel team) → Phase 2 (single)**.
> Verify-first still governs: Phase 0 confirms the real schema before anyone builds.
> Architectural prompts end with **"Plan first. Wait for approval."**

---

## Native checkout — DONE (reference)

The repo is migrated to `~/vivahOS` (native ext4). Full setup, the gotchas hit
during migration, and the fixes are in **`NATIVE-SETUP-AND-ENV.md`**. The
correct cache-bypass flag for this repo is **`pnpm type-check --force`** (single
dashes → Turbo; `-- --force` wrongly forwards to `tsc` and errors).

## Session preflight (run at the start of every WSL session)

```
cd ~/vivahOS
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1        # in ~/.bashrc to persist
export NODE_OPTIONS=--max-old-space-size=12288       # db type-check OOMs without this
docker compose up -d && docker compose ps            # postgres healthy on 5433, redis healthy
free -h                                              # confirm ~15-16Gi (WSL memory)
```

If a type-check OOMs or hangs after a crash, clear the stale db cache and retry:
`rm -rf packages/db/.turbo packages/db/dist && pnpm type-check --force`

---

## How a parallel sprint runs

1. **Phase 0 (single agent):** verify real schema + high-water mark; lay down ALL
   migrations + shared types/schemas the sprint needs; commit to the sprint branch.
2. **Phase 1 (team):** spawn N teammates, one worktree each off the sprint branch;
   each owns a disjoint file set; **`index.ts` / route mounting owned by nobody.**
3. **Phase 2 (single agent):** mount routes, integrate, smoke test, browser-verify
   375/1440, merge `--no-ff`, forced type-check, push, delete branch + worktrees.

> Not running a team today? Do the units solo in dependency order (5.1 → 5.2 →
> 5.5 → 5.4 → 5.3 → 5.7 → 5.6). Each unit brief below works standalone too.

---

# SPRINT A — Utilization + Calendar + B2B (the first 3 Tier-1 units)

## A · Phase 0 (single agent) — verify + lay all schema

```
Smart Shaadi — Phase 5 Sprint A, Phase 0. Single agent. Native checkout ~/vivahOS.
Do NOT spawn teammates in this phase. Do NOT implement features yet.

ENV SETUP (run first, before any type-check in this session):
- export NODE_OPTIONS=--max-old-space-size=12288   (db type-check OOMs without it)
- docker compose up -d && docker compose ps  → postgres healthy on 5433, redis healthy
- The cache-bypass flag here is `pnpm type-check --force` (single dashes).
- If a type-check OOMs/stalls: rm -rf packages/db/.turbo packages/db/dist, then retry.

VERIFY AND REPORT FIRST (before any code):
- packages/db/schema/*.ts + the highest committed migration number in
  packages/db/migrations/ (the REAL high-water mark).
- Confirm vendor_event_types (vendor_id, event_type ceremony_type, available)
  EXISTS — it's the Utilization Engine foundation.
- State EXISTS / ABSENT for each: a seeded calendar table (muhurat+festival+
  govt+school), contracts, b2b_accounts, pricing_rules, and any "pricing core"
  module. The kickoff doc claims these via "migration 0028" but I could only
  confirm up to 0025 — report the truth.
- Report the money representation actually used (BigInt paise vs decimal).

THEN (after I approve the findings) lay down ONLY the shared schema the sprint
needs, as ONE coherent set:
- If the calendar table is ABSENT: create it + seed it (muhurat dates, major
  festivals, govt holidays, school-vacation windows for the launch region). Use a
  documented DEFAULT for the 4 unresolved conventions (devshayani, January, Vishu,
  Onam) and flag them in comments for Colonel — do not block on his ruling.
- If contracts / b2b_accounts / pricing_rules are ABSENT: design + create them.
- Shared TS types/schemas in packages/types + packages/schemas for all three units.
- Generate migrations at the next number(s) after the real high-water mark;
  COMMIT them. Never drizzle-kit push to prod.
- Commit shared types. This frozen schema is what the team builds against.

Do NOT touch feature services/routes/UI or apps/*/index.ts in this phase.

Plan first. Wait for approval.
```

## A · Phase 1 (parallel team) — implement on the frozen schema

```
Smart Shaadi — Phase 5 Sprint A, Phase 1. Spawn a 3-teammate agent team.
Schema is frozen (Sprint A Phase 0 committed). One worktree per teammate off the
sprint branch. NOBODY touches apps/api/src/index.ts or apps/web route mounting —
that's Phase 2. NOBODY generates migrations — schema is frozen.

FILE-OWNERSHIP MAP (do not cross):
- Teammate A — Vendor Utilization Engine (Unit 5.1)
    owns: apps/api/src/vendors/utilization.* (+ service/router additions scoped to
          vendors), apps/api/src/vendors/__tests__/*, apps/web vendor-dashboard pages.
    build: deterministic ranking of idle vendor capacity by date/season; surface
           off-season non-wedding event routing (CORPORATE/FESTIVAL/COMMUNITY/
           GOVERNMENT/SCHOOL) from vendor_event_types; "You're eligible for N
           upcoming <type> events" dashboard section; event-type+window filter in
           search. Pure algorithmic, NO LLM. Unit tests for the ranking fn.
- Teammate B — Calendar Intelligence UI (Unit 5.2)
    owns: apps/api/src/calendar/* (read service over the Phase-0 calendar table),
          apps/web calendar/heat-map pages + client components.
    build: month heat-map "best dates" view — auspicious muhurat days highlighted
           (Gold #C5A47E), festival/govt/school windows marked, demand shown as
           heat. Server components by default; client only for interaction. No LLM.
- Teammate C — B2B self-serve (Unit 5.5)
    owns: apps/api/src/b2b/* (accounts, contracts, invoices), apps/web b2b pages.
    build: create B2B account → generate contract → generate invoices. Server
           Actions for mutations (no Next API routes for CRUD). Invoice PDF uses
           "Rs." NOT ₹ (Helvetica bug). Money per the frozen representation.
           Filter by userId / account ownership.

SHARED RULES (all teammates):
- No `any`. Standard envelope { success, data, error, meta } on API responses.
- Design tokens: Ivory #FEFAF6 page bg (never white), Teal #0E7C7B CTAs, Burgundy
  #7B2D42 brand, 44px touch targets, Playfair headings.
- Write tests alongside code. Do not touch another teammate's files or index.ts.
- /compact at ~70% context. Commit your unit when its tests pass.

No plan approval needed for teammates — implement to this brief immediately.
```

## A · Phase 2 (single agent) — integrate, verify, merge

```
Smart Shaadi — Phase 5 Sprint A, Phase 2. Single agent. Shut the team down first.

1. Mount all new routes in apps/api/src/index.ts (utilization, calendar, b2b) and
   confirm apps/web pages are reachable.
2. Resolve any import/type seams between the three units.
3. Verify:
   - pnpm type-check -- --force   (NOT cached)
   - api tests green in WSL — report the actual before/after test count.
   - ai-service tests if Python was touched.
4. Browser-verify as REAL QA logins at 375px AND 1440px:
   - vendor: utilization "eligible events" section renders + filters
   - any user: calendar heat-map renders + date selection works
   - b2b: create account → contract → invoice; confirm PDF shows "Rs."
5. Merge from WSL: git merge --no-ff into main, run forced type-check again, push,
   delete the sprint branch, confirm `git worktree list` shows only main.

Report the final test count and each browser-verify result explicitly.
```

---

# SPRINT B — Pricing + Gap Detection (after Sprint A merged)

## B · Phase 1 (parallel team, 2 teammates)

```
Smart Shaadi — Phase 5 Sprint B. Sprint A is merged (calendar + utilization live).
No new migrations expected; if one is needed, STOP and do a single-agent Phase 0
first. Spawn a 2-teammate team, one worktree each, index.ts owned by nobody.

OWNERSHIP MAP:
- Teammate A — Dynamic Pricing full (Unit 5.4)
    First confirm the "pricing core" location/formula from Sprint A findings; if it
    doesn't exist, build it here. Implement clamp(base × muhurat × offseason ×
    demand): muhurat premium + off-season discount from the calendar table, demand
    from booking density, clamp to floor/ceiling. Deterministic, HIGH test coverage
    (money logic) incl. clamp edges. Surface price + plain-language breakdown in UI.
    owns: apps/api/src/pricing/*, its tests, the pricing UI components.
- Teammate B — Vendor Gap Detection (Unit 5.3)
    Compute (city × category) supply vs a configurable threshold; flag under-supply
    as an admin dashboard card + optional alert. Pure algorithmic.
    owns: apps/api/src/vendors/gap.* + tests, apps/web admin gap card.

Shared rules as Sprint A. Then a single-agent Phase 2: mount, verify
(type-check --force + real test count), browser-verify pricing breakdown + admin
card at 375/1440, merge from WSL.
```

---

# SPRINT C — Analytics + Docs/e-sign

```
Smart Shaadi — Phase 5 Sprint C. 2-teammate team, worktrees, index.ts owned by nobody.

OWNERSHIP MAP:
- Teammate A — Advanced analytics/forecasting (Unit 5.7): forecasting/reporting on
  EXISTING data (utilization/demand/revenue), deterministic methods first (moving
  average / seasonal index), charts as PURE SVG (no new packages). owns:
  apps/api/src/analytics/* + tests, apps/web analytics pages.
- Teammate B — Docs/compliance generator + e-sign (Unit 5.6): contract/document
  generator + e-sign behind a KYC/e-sign mock (shouldUseMockX = USE_MOCK_SERVICES
  || !X_LIVE), swappable to DigiLocker via one flag. NEVER store Aadhaar/raw KYC —
  status only. PDFs use "Rs." owns: apps/api/src/documents/* + tests, apps/web docs pages.

Single-agent Phase 2: mount, verify (type-check --force + real test count),
browser-verify 375/1440, merge from WSL.
── Then: Phase 5 demo checkpoint with Colonel. ──
```

---

# SPRINT D — WhatsApp + Financial shells (Tier 2/3)

## D · Phase 0 (single agent) — shared referral model + read the regs

```
Smart Shaadi — Phase 6 Sprint D, Phase 0. Single agent.
READ FIRST: PHASE-6-FINANCIAL-SERVICES-REFERENCE.md + its 2026 addendum (RBI
Digital Lending Directions 2025 replaced the 2022 guidelines — neutral multi-lender
display, KFS link, borrower-direct disbursal / RE-direct repayment, India-only data,
no dark patterns) and the mock-service pattern. Confirm NO Meta/BSP, NO aggregator,
NO NBFC credentials exist. Report high-water mark.

THEN lay down the shared data model both financial shells use:
- referral tracking that generalizes to lending (referral→disbursal→commission) and
  insurance (referral→policy→commission). Commission is the revenue line — never
  interest/premium. Store only permitted, India-resident data. Migration at next
  real number, committed. Shared types in packages/types.

Do NOT build placement UI or WhatsApp here. Plan first. Wait for approval.
```

## D · Phase 1 (parallel team, 3 teammates — all mock/flagged)

```
Smart Shaadi — Phase 6 Sprint D, Phase 1. 3-teammate team, worktrees, index.ts owned
by nobody. Everything here is FLAGGED + MOCKED — no live external calls.

- Teammate A — WhatsApp Business (Unit 6.1, Tier 2): send integration behind
  WHATSAPP_LIVE (shouldUseMockWhatsApp = USE_MOCK_SERVICES || !WHATSAPP_LIVE); mock
  logs payload + returns success. Template messages for booking confirmations/
  reminders, enqueued via Bull (never sync). owns: apps/api/src/whatsapp/* + tests.
- Teammate B — Lending placement shell (Unit 6.2, Tier 3, MOCK ONLY): contextual
  loan-offer placement in the planning/booking flow behind LENDING_LIVE; mock
  returns a fake offer, NEVER a real API. Consent/disclosure copy already compliant
  with RBI Directions 2025 (Smart Shaadi = LSP not lender; KFS link slot; neutral
  multi-offer layout; no pre-ticked consent; no dark patterns; no money through us).
  owns: apps/api/src/lending/* + tests, apps/web lending placement + consent screens.
- Teammate C — Insurance placement shell (Unit 6.3, Tier 3, MOCK ONLY): placement at
  booking confirmation behind INSURANCE_LIVE; mock returns a fake quote. Lead copy
  with a STANDARD SKU (health/life/travel); wedding-event cover is niche/secondary.
  IRDAI disclosure: clear insurer-identity slot, no pre-ticked consent, grievance
  path placeholder. owns: apps/api/src/insurance/* + tests, apps/web insurance placement.

All use the Sprint-D Phase-0 referral model. Label in UI copy that these are not
live. Single-agent Phase 2: mount, verify (type-check --force + real test count),
browser-verify 375/1440, merge from WSL.

PARALLEL (Colonel session, not code): apply for Meta Business + BSP; gather NBFC/
insurance aggregator terms.
```

---

# SPRINT E — Mobile scaffold (Tier 2, after launch validation)

```
Smart Shaadi — Phase 7 Sprint E, Unit 7.1: React Native + Expo scaffold.
WEEKS of real work, NOT "90% reuse." This one is an INTERNAL team-split within a
single unit, not independent units.

VERIFY FIRST: packages/types + packages/schemas (these DO help). Confirm auth is
Better Auth + phone OTP with SESSION COOKIES (not JWT) — mobile must handle cookie
sessions. Report what apps/mobile currently contains.

BUILD (scaffold only): React Native 0.78 + Expo SDK 55 + Expo Router v4 + NativeWind
in apps/mobile; wire shared packages; phone-OTP auth with cookie-session handling;
ONE core screen; EAS Build CI. Do NOT attempt feature parity in this unit.

If team-splitting: Teammate A = scaffold+navigation+EAS; Teammate B = auth flow;
integration single-agent. Verify: type-check --force; EAS build succeeds; auth works
against a real QA account. Report honestly what is / isn't done.

PARALLEL (Colonel): Apple Developer + Google Play enrolment — start now.

Plan first. Wait for approval.
```

---

## Standalone (sequential) unit briefs

Any unit above can run solo without a team — just paste its build description from
the ownership map into a single session, prefixed with:

```
VERIFY FIRST (report before code): read the actual schema for <tables this unit
touches>, the real migration high-water mark, and the relevant existing routers +
money representation. State EXISTS/ABSENT for anything the kickoff doc claims.
Then a 3-line plan. If a migration is needed, create it at the next real number,
committed (never pushed to prod). Build one atomic unit. Verify: type-check --force
+ real api test count + browser 375/1440 if UI. Merge --no-ff from WSL.
Plan first. Wait for approval.
```

---

## Note on 6.4 / 6.5 / Phase 8 Tier-3 units

Auto-marketing (6.4), multi-city (6.5), post-marriage (8.2), destination live
supply (8.1) are **Tier 3 — do not build blind.** They need real launch traffic /
vendor density / partner agreements. When one unblocks, write its sprint with the
same Phase-0 verify → mock-until-real template.
