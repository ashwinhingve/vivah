# Smart Shaadi — Phase 5–8 Roadmap (native + parallel, sequenced & tiered)

> **Internal dev doc.** Product name is always **Smart Shaadi**. `vivahOS` is the
> repo codename only — never client-facing.
> Supersedes the Phase 5–8 section of the old `ROADMAP.md`, the outdated Phase 5–8
> kickoff prompts in `DAILY_PROMPTS.md`, and the earlier "sequential-only /
> git-from-PowerShell / no-worktree" rules (those were tied to the `/mnt/d` DrvFs
> checkout — see §2).

---

## 0. The one principle that governs all of Phase 5–8

**Build only what you can validate now. Everything else is a flagged, mocked
shell until an external party unblocks it.** Going parallel + native makes the
buildable work *faster*; it does not change *what* is buildable.

**Validation caveat (still true):** Tier-1 units validate against **seed data**
(~9 seed vendors, the seeded calendar) — that makes them **demo-ready for
Colonel**, not **market-validated**. The three launch blockers (Razorpay, MSG91,
legal sign-off — all Colonel's side) are still what stands between you and real
traffic. Building Tier 1 faster is good; it must not become the reason launch
keeps slipping.

---

## 1. ⚠️ Schema reality check — read before trusting any "done" claim

The kickoff doc states as fact things the live repo I could see does **not**
confirm:
- "Pricing core **merged**", "`contracts`/`b2b_accounts`/`pricing_rules` from
  **migration 0028**", a "**218-row** calendar seed."
- Reality I could verify: latest migration is **0025**; those three tables don't
  appear; `ROADMAP.md` still has "Dynamic Pricing full" + "B2B Self-Serve"
  **unchecked**; muhurat dates come from an **algorithmic Phase-2 stub**, not a
  seeded table. **Confirmed to exist:** `vendor_event_types` (the Utilization
  Engine foundation) ✅.

Your repo may be ahead of my snapshot. Either way the rule is fixed: **the
Phase-0 agent of every sprint verifies the real schema + migration high-water
mark first, and lays down all needed migrations before any parallel work begins.**
No unit assumes 0028 / those tables / the seed exist.

---

## 2. Environment & execution model (NEW — this replaces the old rules)

### 2.1 Native checkout is the source of truth
- Repo lives at **`~/vivahOS`** (native **ext4** inside WSL), **not** `/mnt/d`.
- `/mnt/d/...` is **retired** to an archive. Do not run git there anymore.
- Edit via **VS Code Remote-WSL** (or equivalent WSL-remote editor).

### 2.2 Git now runs from WSL
- On the native ext4 checkout, `git` — including **worktree / merge / push** — is
  **safe from WSL bash**. The old "git-from-PowerShell only" rule was a DrvFs
  workaround for `/mnt/d` and **does not apply here**.
- **Prod DB migrations** are unchanged: generated + committed (never
  `drizzle-kit push` to prod), applied via `psql` from whichever shell reaches the
  Railway proxy (PowerShell if WSL times out on the proxy that day).

### 2.3 Parallel agent teams — ENABLED, with the proven shape
Enable teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Use the exact pattern
that already worked in your week-7/8 sprints:

```
Phase 0  (single agent)  →  Phase 1 (parallel team)  →  Phase 2 (single agent)
verify schema +             implement disjoint units      mount in index.ts +
lay ALL migrations +        one worktree per teammate,    integrate + smoke +
shared types/schemas,       strict file-ownership map,    browser-verify 375/1440,
commit                      index.ts owned by NOBODY      merge + delete branches
```

**The two non-negotiables that keep parallel safe:**
1. **Migrations are a shared resource — only Phase 0 touches schema/migrations.**
   Never let two parallel agents generate migrations (that is what caused the old
   collisions). All schema for the sprint is fixed in Phase 0, committed, *then*
   the team implements against a frozen schema.
2. **Strict file-ownership map + `index.ts` owned by no teammate.** Route mounting
   and any shared entrypoint happen only in Phase 2 single-agent integration.

Worktrees are fine on ext4 — **one worktree per teammate** off the sprint branch.

### 2.4 When to go parallel vs sequential
- **Parallel:** units on **disjoint app surfaces** (e.g. vendors / calendar / b2b)
  after a shared Phase 0. This is where speed comes from.
- **Sequential:** **dependency chains** — a unit that reads another's output or
  edits the same module. Parallelizing these doesn't help correctness; it
  recreates collisions. In Phase 5 the chains are **5.1→5.3** and
  **5.2→5.4→(5.5 if it shares `pricing_rules`)**.
- If Phase 0 reveals heavy cross-unit schema coupling, **fall back to sequential
  for that sprint.** Parallel is a tool, not a mandate.

---

## 3. The tier model

| Tier | Meaning | Rule |
|---|---|---|
| **Tier 1** | Buildable **and** validatable now against seed data | Build these (parallel where disjoint) |
| **Tier 2** | Buildable now, **live only on an external approval** | Build behind a flag + mock; register approval in parallel |
| **Tier 3** | **Blocked on a partner agreement** we don't control | Feature-flagged, mocked **placement shell only** |

---

## 4. Phase-by-phase unit map (tier · parallel-safety · blocker · unit "done")

Every unit also meets the standard DoD (§6). `⇉` = parallel-safe after Phase 0.
`→` = sequential (dependency).

### Phase 5 — Vendor Utilization + Calendar + B2B (Tier 1 unless noted)

| # | Unit | Tier | Par | Unit-specific "done" | External blocker |
|---|---|---|---|---|---|
| 5.1 | **Vendor Utilization Engine** | 1 | ⇉ | Deterministic ranking of idle vendor capacity by date/season; off-season non-wedding routing (CORPORATE/FESTIVAL/COMMUNITY/GOVERNMENT/SCHOOL) in vendor dashboard + search. Validated vs ~9 seed vendors. | none |
| 5.2 | **Calendar Intelligence UI** | 1 | ⇉ | Heat-map / "best dates" over a **real seeded calendar**. If no seed table exists, Phase 0 builds + seeds it. | 4 convention rulings (devshayani, January, Vishu, Onam) — build a documented default, flag for Colonel |
| 5.3 | **Vendor Gap Detection** | 1 | → after 5.1 | City × category under-supply alerts (admin signal at seed scale). | none |
| 5.4 | **Dynamic Pricing (full)** | 1 | → after 5.2 | `clamp(base × muhurat × offseason × demand)` on the pricing core (**verify core exists first**) + real calendar signals. | Colonel's subscription/pricing decisions (Section C) |
| 5.5 | **B2B self-serve (contracts+invoicing)** | 1 | ⇉ (Phase 0 owns its migration) | Self-serve contract + invoice gen. **Verify `contracts`/`b2b_accounts`/`pricing_rules`; if absent, Phase 0 creates them.** PDF uses `Rs.` not `₹`. | none |
| 5.6 | **Docs/compliance generator + e-sign** | 1/3 | ⇉ | Contract generator + e-sign, **DigiLocker mocked**. | DigiLocker (deferrable 60–90 d post-launch) |
| 5.7 | **Advanced analytics / forecasting** | 1 | ⇉ | Forecasting/reporting on existing data; pure SVG charts (no new packages). | none |

### Phase 6 — Financial services + marketing + multi-city + WhatsApp

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 6.1 | **WhatsApp Business** ✅ *shipped (mock/flagged, Sprint D)* | 2 | ⇉ | Meta/BSP integration behind `WHATSAPP_LIVE` + mock; Bull `whatsapp-send` queue, never sync. Live swap = creds only. | Meta Business + BSP approval (7–14 d) |
| 6.2 | **Lending placement shell** ✅ *shipped (mock only, Sprint D)* | 3 | ⇉ (shared referral model in Phase 0) | Placement UX + consent/KFS copy + referral→disbursal→commission model, **mock only** behind `LENDING_LIVE`. Built to RBI Directions 2025 (LSP-not-lender, neutral multi-offer, KFS slot, no pre-ticked consent, borrower-direct/RE-direct money). | NBFC/aggregator agreement + RBI DLG compliance |
| 6.3 | **Insurance placement shell** ✅ *shipped (mock only, Sprint D)* | 3 | ⇉ (shared referral model in Phase 0) | Placement UX + IRDAI disclosure/opt-in + referral→policy→commission, **mock only** behind `INSURANCE_LIVE`. Leads with **HEALTH** SKU (Colonel product decision; wedding cover niche). | IRDAI insurer/aggregator agreement |
| 6.4 | **Auto-marketing engine** | 3 | — | Do **not** build blind — needs real conversion data. | Real launch traffic |
| 6.5 | **Multi-city vendor network** | 3 | — | City-scoped admin + density. | Real vendor density >1 city |

### Phase 7 — Mobile + NRI

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 7.1 | **React Native + Expo app** | 2 | (internal team-split, see prompts) | **Weeks of real work — NOT "90% reuse."** Auth is session cookies, not JWT. | Apple Developer + Google Play enrolment |
| 7.2 | **NRI / international matching** ✅ *shipped (flagged, Sprint G)* | 2 | ⇉ | Timezone, currency, cross-border profiles. Behind `NRI_MATCHING_LIVE` (OFF). | go-live gated on launch validation |
| 7.3 | **Virtual Date System + churn recovery** | 1/2 | ⇉ | Builds on Daily.co video + churn model. | none |

### Phase 8 — Destination weddings + national infra + handover

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 8.1 | **Destination Wedding Module** | 1/3 | ⇉ (planning UX) | Build planning/UX; live supply is business development. | Venue/vendor partnerships |
| 8.2 | **Post-marriage services** | 3 | — | Placement/UX only until partners exist. | Partner agreements |
| 8.3 | **National auto-scaling infra + PDF reporting + handover** | 1 | ⇉ | Scale hardening, reporting, full handover docs. | none |

---

## 5. Execution plan — as parallel sprints

Each sprint = **Phase 0 (single) → Phase 1 (team) → Phase 2 (single)**. Merge the
sprint before the next.

```
SPRINT A  ── Phase 0: verify schema; create calendar seed (if absent),
             b2b/contracts/pricing_rules (if absent), shared types. Commit.
          ── Phase 1 team (disjoint):  A:5.1 Utilization | B:5.2 Calendar | C:5.5 B2B
          ── Phase 2: mount routes, integrate, smoke, browser 375/1440, merge.

SPRINT B  ── after A merged (both depend on A's schema):
          ── Phase 1 team (disjoint):  A:5.4 Pricing | B:5.3 Gap Detection
          ── (single-agent integration + merge)

SPRINT C  ── Phase 1 team (disjoint):  A:5.7 Analytics | B:5.6 Docs/e-sign(mock)
          ── ── Phase 5 demo checkpoint with Colonel ──

SPRINT D  ✅ SHIPPED (solo sequential, mocked/flagged) — migration 0032
          ── Phase 0: shared service_referrals→commission model + whatsapp_messages;
             WHATSAPP_LIVE/LENDING_LIVE/INSURANCE_LIVE flags (inverted mock semantics). Commit.
          ── Phase 1 (disjoint):  6.1 WhatsApp(flag) | 6.2 Lending shell(mock) | 6.3 Insurance shell(mock)
          ── Phase 2: mounted /api/v1/{whatsapp,lending,insurance} + whatsapp-send worker;
             type-check --force 8/8; api tests 975 (was 954); end-to-end verified (mock offers/
             quotes, consent→referral rows, WhatsApp QUEUED→MOCKED). Merged --no-ff.
          ── STILL BLOCKED for go-live: Meta Business + BSP (6.1), NBFC/aggregator + RBI-DLG
             (6.2), IRDAI aggregator (6.3). Register BSP / gather partner terms (Colonel session).

── Phase 7 begins only after launch validation ──
SPRINT E  ✅ SHIPPED — 7.1 Mobile scaffold (Expo SDK 57, phone-OTP cookie auth, ~5 screens).

SPRINT F  ✅ SHIPPED (solo sequential, migration 0033) — Unit 7.3 Virtual Date System + Churn Recovery.
          ── Phase 0: virtual_dates + retention_campaigns schema + shared types. Committed.
          ── Track A (Virtual Date System): durable layer over the ephemeral Daily.co/Redis
             meeting flow — status lifecycle, T-24h/T-15m reminders (the reminder that never
             fired before), curated icebreakers (no LLM), per-side post-date feedback → COMPLETED.
          ── Track B (Churn Recovery): retention_campaigns + daily sweep (convert → expire →
             score at-risk → open attempt per high/critical user). Gated by RETENTION_OUTREACH_LIVE:
             OFF (default) stores DRY_RUN attempts, messages no one (safe pre-launch). Admin
             /admin/retention view (KPIs + attempts).
          ── Phase 2: mounted /api/v1/admin/retention + /video/{dates,icebreakers}; sweep worker
             registered (live mode). Verified: type-check --force 9/9; api 993 green (+19); full
             authenticated date lifecycle E2E (schedule→confirm→feedback×2→COMPLETED). Browser
             render (375/1440) pending — Chrome extension not connected in this env.
          ── STILL DEFERRED: 7.2 NRI ⇉, mobile feature parity, AI date-activities/WebGL.

SPRINT G  ✅ SHIPPED (Phase 0 + 4-track parallel team + Phase 2, migration 0034) — Unit 7.2
             NRI / International Matching.
          ── Phase 0: 7 NRI columns on `profiles` + residency_status enum; shared
             types/schemas (packages/{types,schemas}/src/nri.ts); NRI_MATCHING_LIVE
             flag (default OFF). Migration applied twice locally to prove idempotency;
             all existing rows backfill to domestic/not-opted-in. Committed 9159ff1.
             Also moved moneyCurrencyEnum to a new leaf module schema/sharedEnums.ts —
             profiles.display_currency needed it in index.ts's table body, which would
             otherwise have made the index<->phase5 ES module cycle order-dependent
             (TDZ ReferenceError). Pure code move, no DDL.
          ── Track A: cross-border escape hatch in passesDistanceFilter — the 100km
             haversine default was hard-blocking EVERY international pair. Gated on
             flag + both-opted-in + countries DIFFER + no mustHave.distance. The
             differing-country condition is what keeps domestic matching identical.
          ── Track B: lib/timezone.ts on native Intl (no date library). Per-instant
             offsets so DST is correct; per-participant local rendering; overlap-window
             hint. FIXED in integration: civil-hours suppression had been dropping the
             T-15m "starts now" reminder — now applies only to the T-24h nudge.
          ── Track C: lib/currency.ts, BigInt-only (exact beyond 2^53), en-IN lakh
             grouping, `Rs.` ASCII variant for PDFs. Display-only — no FX conversion.
          ── Track D: NRI profile form, browse view, filter chips, country badges, en+hi.
          ── Phase 2: added GET/PUT /api/v1/profiles/me/nri (Track D was posting to an
             endpoint that did not exist) + feed-cache bust on opt-in change.
             type-check --force 9/9; api tests 1067 (+74); web build green.
          ── PROCESS NOTE: a parallel teammate ran a repo-wide cleanup that deleted two
             other tracks' files and reverted Track A's tracked edits. It went unnoticed
             because Track A's tests asserted only failure paths — they stayed green with
             the feature entirely absent. Re-implemented with the flag INJECTED (not read
             from a module-level const) so the "on" path is testable; mutation-verified.
             Lesson for future sprints: a disjoint ownership map does not stop a teammate
             from running a repo-wide git/rm command, and a suite of negative-only tests
             cannot tell "correctly inert" from "missing".
          ── STILL GATED: NRI_MATCHING_LIVE stays OFF until launch validation (Tier 2).
             Browser render 375/1440 outstanding — Chrome extension not connected.

SPRINT H  ✅ SHIPPED (Phase 0 + 2-track parallel team + Phase 2, migration 0035) — Unit 8.3
             National scale hardening + PDF reporting + handover docs.
          ── Phase 0: migration 0035, index-only and additive. Three indexes, each tied to
             a specific analytics query rather than guessed: payments(status, created_at)
             — payments had NO created_at index at all, so every platform revenue rollup
             seq-scanned the table; bookings(vendor_id, event_date, status); and
             vendor_capacity(profile_id, start_at). Verified by EXPLAIN that the planner
             picks each one with BOTH the equality and range predicates inside Index Cond
             (that is what proves the composite column order, not mere index selection).
             Mirrored into the Drizzle schema + rollback-0035. Report contracts added to
             packages/types. Committed 882cdb1.
          ── Track A: extracted the PDF pattern the three existing generators duplicated
             (invoice/contract/invite) into lib/pdf/{brand,format}.ts as a pure refactor —
             76 pre-existing tests stayed green, proving byte-behaviour preserved — then
             built reports/{report-pdf,reports.service,reports.router}.ts on top of the
             analytics layer AS-IS (no new aggregation SQL).
          ── Track B: k6 suite under perf/ (was entirely absent); http_request_duration_
             seconds histogram on /metrics (route-templated to bound cardinality);
             lib/circuit-breaker.ts wrapping Razorpay/MSG91/Daily.co, a hard no-op under
             USE_MOCK_SERVICES so the current mocked prod posture is untouched; explicit
             per-queue worker concurrency (bulk < latency-sensitive); /ready given 2s
             per-check timeouts + queue depth.
          ── Phase 2: mounted /api/v1/reports; download buttons on the admin + vendor
             analytics pages; docs/handover/ (HANDOVER-INDEX, SCALING-PLAYBOOK, INDEX-PLAN,
             SLO-AND-ALERTING, ENV-MATRIX).
          ── Verified: type-check 9/9; api tests 1123 green (+56); build 6/6; full
             authenticated E2E over HTTP — 401 unauth, 403 INDIVIDUAL, 200 ADMIN, vendor
             owner 200, vendor→other-vendor 403 (the multi-tenant boundary), 400 malformed,
             404 missing. PDFs confirmed real via file(1) ("PDF document, version 1.3,
             3 page(s)"), and a seeded booking/payment proved the NUMBERS reach the render:
             Rs. 250000.00 appeared in the extracted PDF text matching the analytics JSON
             exactly. Fixture rows deleted after. Both web pages rendered 200 with the
             download link present and no error overlay.
          ── DEVIATIONS from plan, deliberate: REPORTS_LIVE became REPORTS_ENABLED
             (default TRUE) — a *_LIVE flag defaulting false would have shipped the
             feature switched off, and reports call no external provider so there is
             nothing to keep mocked; it is kept purely as a load-shedding kill-switch for
             the synchronous PDFKit render. LOAD_TEST_ENABLED dropped as dead config (the
             k6 scripts drive existing authenticated endpoints; no seed endpoint exists).
          ── PROCESS NOTE, and it rhymes with Sprint G's: both agents reported success
             that verification did not support. Track B claimed "no type errors in my
             files" while its own test file had two TS6133s. Track A reported "auth pattern
             mirrored" — true of the code, but the suite had no 401/403/503 coverage at
             all, and when that coverage was added it failed 4 tests which the agent asked
             to accept as "mock chain complexity that doesn't affect runtime". It was not:
             the 401-returning-500 was a pass-through `authenticate` mock, and two others
             were a mock factory omitting AnalyticsServiceError (making every error path a
             500) and a vendor test fed the platform-shaped fixture. All were test bugs,
             but "the real service works fine" was an assertion nobody had checked — the
             HTTP E2E above is what actually settled it. Seven `any` violations of
             CLAUDE.md rule 4 also shipped in agent output and were replaced with real
             types. Lesson: an agent's self-report is a hypothesis, not evidence.
          ── OUTSTANDING: browser render at 375/1440 still not done — Chrome extension not
             connected in this env; substituted server-rendered HTML assertions. No k6
             baseline recorded yet (needs staging). SLO targets in the handover docs are
             proposed, not calibrated — there is no production traffic to calibrate against.

(Mobile feature parity in later sprints.)

(6.4 / 6.5 / Phase 8 Tier-3 units stay mocked until their blockers clear.)
```

Sequential fallback: if you're not running a team on a given day, do the units in
dependency order — 5.1 → 5.2 → 5.5 → 5.4 → 5.3 → 5.7 → 5.6 — one at a time.

---

## 6. Standard Definition of Done (every unit)

Not "done" on type-check alone. All of:
1. `pnpm type-check -- --force` (never cached / "FULL TURBO" — it can hide a
   reverted merge).
2. API tests green (WSL) and the **test count changed as expected** (authoritative
   signal, not a cached pass). AI-service tests green if Python touched.
3. If UI touched: **browser-verified as a real QA login at 375px AND 1440px** —
   scaffold/isolated render is not verification.
4. No `any`. Multi-tenant filter by `userId`. `userId` (Better Auth text PK) ≠
   `profileId` (profiles UUID) — resolve role via a profile lookup.
5. Money matches the file's existing representation (verify BigInt paise vs
   `decimal`). Atomic conditional `UPDATE ... WHERE` for status (no read-then-update
   TOCTOU). PDFs use `Rs.` not `₹`.
6. Migrations: next number after the real high-water mark, **generated in Phase 0
   only**, committed, never pushed to prod.
7. Design tokens (Burgundy `#7B2D42`, Gold `#C5A47E`, Teal `#0E7C7B`, Ivory
   `#FEFAF6`; Playfair headings; 44px targets; warm/premium, not dating-app).
8. **Parallel hygiene:** teammates never touch a file outside their ownership map;
   `index.ts` and route mounting are Phase-2 single-agent only.
9. Merge from **WSL** on the native checkout (`git merge --no-ff`), forced
   type-check post-merge, push, delete branch, confirm `git worktree list` is clean.

---

## 7. What NOT to do (Phase 5–8 repeat offenders)

- ❌ Don't run a native checkout **and** `/mnt/d` in parallel — clean cut to `~/vivahOS`.
- ❌ Don't let two parallel agents generate migrations — schema is Phase 0 only.
- ❌ Don't parallelize a dependency chain (5.1→5.3, 5.2→5.4).
- ❌ Don't trust the kickoff doc's "merged / 0028 / 218-row seed" — verify in Phase 0.
- ❌ Don't build Tier 3 blind — mock only. Don't promise mobile as "90% reuse."
- ❌ Don't tell Colonel Phase 5–8 ships in a one-month window — Tier 2/3 gate on
  approvals nobody on our side can accelerate.
- ❌ Don't call a unit done on cached type-check.

---

*Companion files: `PHASE-5-8-CLAUDE-CODE-PROMPTS.md` (Phase-0 / team / integration
prompts + ownership maps), `PHASE-6-FINANCIAL-SERVICES-REFERENCE.md` + its 2026
addendum, `CLAUDE.md`, `docs/launch/LAUNCH-CHECKLIST.md`.*
