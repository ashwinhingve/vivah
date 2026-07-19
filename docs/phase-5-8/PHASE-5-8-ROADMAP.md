# Smart Shaadi — Phase 5–8 Roadmap (native + parallel, sequenced & tiered)

> **Internal dev doc.** Product name is always **Smart Shaadi**. `vivahOS` is the
> repo codename only — never client-facing.
> Supersedes the Phase 5–8 section of the old `ROADMAP.md`, the outdated Phase 5–8
> kickoff prompts in `DAILY_PROMPTS.md`, and the earlier "sequential-only /
> git-from-PowerShell / no-worktree" rules (those were tied to the `/mnt/d` DrvFs
> checkout — see §2).

---

## 0.0 STATUS SNAPSHOT — 2026-07-18

**Every Tier-1 (buildable-now) unit in Phase 5–8 is shipped.** Sprints A–I are
merged to local `main`; the `ui-polish-2/2026-07` branch (design-system polish
over all Phase 5–8 pages) is pushed and awaiting review + merge. What remains is
either (a) gated on an external approval/partner (Tier 2/3 — mocked shells are
built and waiting for credentials), (b) gated on real launch traffic, or
(c) mobile feature parity + store submission.

| Shipped | Unit(s) | Sprint |
|---|---|---|
| ✅ | 5.1 VUE · 5.2 Calendar · 5.5 B2B | A (2026-07-17, migration 0028) |
| ✅ | 5.4 Dynamic Pricing · 5.3 Gap Detection | B (2026-07-17) |
| ✅ | 5.7 Analytics/Forecasting · 5.6 Docs/e-sign (mocked `ESIGN_LIVE`) | C |
| ✅ | 6.1 WhatsApp · 6.2 Lending · 6.3 Insurance (all mocked/flagged) | D (migration 0032) |
| ✅ | 7.1 Mobile scaffold (Expo SDK 57, OTP cookie auth) | E |
| ✅ | 7.3 Virtual Dates + Churn Recovery | F (migration 0033) |
| ✅ | 7.2 NRI matching (`NRI_MATCHING_LIVE` OFF) | G (migration 0034) |
| ✅ | 8.3 Scale hardening + PDF reports + handover docs | H (migration 0035) |
| ✅ | 8.1 Destination Wedding **planning core** (Tier-3 supply half NOT built) | I (migration 0036) |
| ✅ | UI Polish Sprint 2 — Phase 5–8 pages to design-system standard, full en+hi | `ui-polish-2/2026-07` |

**Not built:** mobile feature parity / store submission (needs Apple+Google
enrolment).

**Tier-3 units now BUILT, by deliberate deviation from §0 (2026-07-19):**
6.4 Auto-marketing · 6.5 Multi-city network (Sprint J) · 8.1 premium
packages/supply · 8.2 Post-marriage services (Phase 8 supply sprint).

> The original rule was "build only what you can validate now; everything else
> is a flagged, mocked shell." For these four the rule was changed on purpose:
> they are built in full and seeded with **fictional placeholder supply** so
> they work end-to-end in production before any partner signs.
>
> The blocker did not disappear — it moved. Venue and partner agreements now
> gate whether the inventory is **real**, not whether the feature **exists**.
> That is tracked by `is_placeholder` on `vendors`, `premium_packages`,
> `service_partners` and `post_marriage_services`. It is an internal provenance
> marker: it must never hide a row, change its ranking, or alter how it renders.
> It gates exactly one thing, in the service layer — placeholder supply cannot
> be booked or paid for, because no fictional venue can deliver a wedding.
> Enquiries stay fully open, which is the entire point of seeding it.
> Onboarding a real partner is `UPDATE ... SET is_placeholder = false` from
> `/admin/packages` — no schema change, no re-keying, no broken references.
>
> **Before public launch** the placeholder rows still need: licensed
> photography (the seeded images are in-house SVG placeholders), real contact
> details (seeds use RFC-2606 `.invalid` addresses that can never resolve), and
> re-based pricing (the numbers are market-plausible, not quoted by any venue).

**Operational gaps:** local `main` is ~54 commits ahead of `origin/main`
(Sprint I not deployed); `ui-polish-2` unmerged; Phase 5 demo checkpoint with
Colonel not yet held; k6 baseline + SLO calibration need staging/traffic.

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

> **RESOLVED (2026-07-17, Sprint A Phase 0):** migration 0028 created the Phase-5
> tables (`contracts`/`b2b_accounts`/`pricing_rules` + calendar seed) for real.
> High-water mark is now **0036** (Sprint I). The rule above still applies to
> every future sprint.

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
| 5.1 | **Vendor Utilization Engine** ✅ *shipped (Sprint A)* | 1 | ⇉ | Deterministic ranking of idle vendor capacity by date/season; off-season non-wedding routing (CORPORATE/FESTIVAL/COMMUNITY/GOVERNMENT/SCHOOL) in vendor dashboard + search. Validated vs ~9 seed vendors. | none |
| 5.2 | **Calendar Intelligence UI** ✅ *shipped (Sprint A — 56 muhurats 2026 seeded)* | 1 | ⇉ | Heat-map / "best dates" over a **real seeded calendar**. If no seed table exists, Phase 0 builds + seeds it. | 4 convention rulings (devshayani, January, Vishu, Onam) — build a documented default, flag for Colonel |
| 5.3 | **Vendor Gap Detection** ✅ *shipped (Sprint B — `/admin/gaps`)* | 1 | → after 5.1 | City × category under-supply alerts (admin signal at seed scale). | none |
| 5.4 | **Dynamic Pricing (full)** ✅ *shipped (Sprint B — ADR-001, `/vendor/pricing`)* | 1 | → after 5.2 | `clamp(base × muhurat × offseason × demand)` on the pricing core (**verify core exists first**) + real calendar signals. | Colonel's subscription/pricing decisions (Section C) |
| 5.5 | **B2B self-serve (contracts+invoicing)** ✅ *shipped (Sprint A)* | 1 | ⇉ (Phase 0 owns its migration) | Self-serve contract + invoice gen. **Verify `contracts`/`b2b_accounts`/`pricing_rules`; if absent, Phase 0 creates them.** PDF uses `Rs.` not `₹`. | none |
| 5.6 | **Docs/compliance generator + e-sign** ✅ *shipped (Sprint C — DigiLocker mocked behind `ESIGN_LIVE`)* | 1/3 | ⇉ | Contract generator + e-sign, **DigiLocker mocked**. | DigiLocker (deferrable 60–90 d post-launch) |
| 5.7 | **Advanced analytics / forecasting** ✅ *shipped (Sprint C — `/api/v1/analytics`, pure SVG)* | 1 | ⇉ | Forecasting/reporting on existing data; pure SVG charts (no new packages). | none |

### Phase 6 — Financial services + marketing + multi-city + WhatsApp

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 6.1 | **WhatsApp Business** ✅ *shipped (mock/flagged, Sprint D)* | 2 | ⇉ | Meta/BSP integration behind `WHATSAPP_LIVE` + mock; Bull `whatsapp-send` queue, never sync. Live swap = creds only. | Meta Business + BSP approval (7–14 d) |
| 6.2 | **Lending placement shell** ✅ *shipped (mock only, Sprint D)* | 3 | ⇉ (shared referral model in Phase 0) | Placement UX + consent/KFS copy + referral→disbursal→commission model, **mock only** behind `LENDING_LIVE`. Built to RBI Directions 2025 (LSP-not-lender, neutral multi-offer, KFS slot, no pre-ticked consent, borrower-direct/RE-direct money). | NBFC/aggregator agreement + RBI DLG compliance |
| 6.3 | **Insurance placement shell** ✅ *shipped (mock only, Sprint D)* | 3 | ⇉ (shared referral model in Phase 0) | Placement UX + IRDAI disclosure/opt-in + referral→policy→commission, **mock only** behind `INSURANCE_LIVE`. Leads with **HEALTH** SKU (Colonel product decision; wedding cover niche). | IRDAI insurer/aggregator agreement |
| 6.4 | **Auto-marketing engine** ✅ *shipped (Sprint J, migration 0038 — demo-traffic validated; conversion TUNING still needs launch traffic)* | 3 | — | Full lifecycle engine: segments, event/schedule triggers, Gemini copy via ai-service, approval gate, consent + frequency cap, attribution, /admin/marketing. | Real launch traffic (for tuning, not build) |
| 6.5 | **Multi-city vendor network** ✅ *shipped (Sprint J, migration 0038 — cities registry + /admin/cities density dashboard)* | 3 | — | City-scoped admin + density. | Real vendor density >1 city (for signal, not build) |

### Phase 7 — Mobile + NRI

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 7.1 | **React Native + Expo app** — *scaffold shipped (Sprint E); feature parity remaining* | 2 | (internal team-split, see prompts) | **Weeks of real work — NOT "90% reuse."** Auth is session cookies, not JWT. | Apple Developer + Google Play enrolment |
| 7.2 | **NRI / international matching** ✅ *shipped (flagged, Sprint G)* | 2 | ⇉ | Timezone, currency, cross-border profiles. Behind `NRI_MATCHING_LIVE` (OFF). | go-live gated on launch validation |
| 7.3 | **Virtual Date System + churn recovery** ✅ *shipped (Sprint F, `RETENTION_OUTREACH_LIVE` DRY_RUN default)* | 1/2 | ⇉ | Builds on Daily.co video + churn model. | none |

### Phase 8 — Destination weddings + national infra + handover

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 8.1 | **Destination Wedding Module** — *planning core ✅ shipped (Sprint I, migration 0036); premium packages/supply NOT built (Tier 3)* | 1/3 | ⇉ (planning UX) | Build planning/UX; live supply is business development. | Venue/vendor partnerships |
| 8.1s | **Premium packages / destination supply** ✅ *shipped (migrations 0037 + 0039)* | 3→1 | ⇉ | **Tier rule deliberately deviated from.** Built in full — `premium_packages` (+ inclusions, availability), browse/filter/detail, enquiry, admin CRUD — and seeded with FICTIONAL placeholder supply (12 venues, 24 packages) so it works in production before any partnership. `is_placeholder` is internal provenance ONLY: it never hides or down-ranks a row; it gates exactly one thing, in the service layer — placeholder supply cannot be booked or paid for. Enquiries stay open. | Venue partnerships still gate whether the inventory is REAL, not whether the feature exists |
| 8.2 | **Post-marriage services** ✅ *shipped (migrations 0037 + 0039)* | 3→1 | ⇉ | Same deviation and same placeholder contract. 8 admin-editable categories, 16 partners, 28 services, browse/detail/enquiry + admin triage queue. Enquiries are answered by an ADMIN, because a placeholder partner has no user account. | Partner agreements gate real supply only |
| 8.3 | **National auto-scaling infra + PDF reporting + handover** ✅ *shipped (Sprint H — k6 baseline + SLO calibration still need staging/traffic)* | 1 | ⇉ | Scale hardening, reporting, full handover docs. | none |

---

## 5. Execution plan — as parallel sprints

Each sprint = **Phase 0 (single) → Phase 1 (team) → Phase 2 (single)**. Merge the
sprint before the next.

```
SPRINT A  ✅ SHIPPED (2026-07-17, merged f46e826) — migration 0028 laid the
             Phase-5 tables + 56-muhurat 2026 calendar seed for real.
          ── 5.1 Utilization (VUE off-season routing) | 5.2 Calendar | 5.5 B2B.

SPRINT B  ✅ SHIPPED (2026-07-17, merged f7bde4f)
          ── 5.4 Dynamic Pricing (ADR-001 PricingAdvisor, /vendor/pricing)
             | 5.3 Gap Detection (/admin/gaps, threshold-configurable).

SPRINT C  ✅ SHIPPED (merged 1d82a54)
          ── 5.7 Analytics/Forecasting (/api/v1/analytics, pure SVG)
             | 5.6 Docs/e-sign (/api/v1/documents, DigiLocker mocked, ESIGN_LIVE).
          ── ⚠️ Phase 5 demo checkpoint with Colonel — STILL PENDING.

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

SPRINT I  ✅ SHIPPED (solo, migration 0036) — Unit 8.1 Destination Wedding
             **planning core**: multi-city legs (wedding_destinations) with
             country/timezone/date window, ceremonies attachable per leg, per-leg
             guest travel (guest_travel_legs). API /api/v1/weddings/:id/destinations,
             UI /weddings/[id]/destinations (list·detail·new·edit), en+hi.
          ── Full DoD met: type-check --force; api 1174 (+43) mutation-checked;
             migration idempotent (applied twice) + 4 DB invariants on real rows;
             authenticated HTTP E2E 21/21 + 10/10; browser 375/1440 en+hi.
          ── Tier-3 half (premium packages / real destination supply) deliberately
             NOT built — blocked on venue/vendor partnerships.
          ── ⚠️ NOT YET PUSHED: Sprint I sits on local main (~54 commits ahead of
             origin/main). Push after ui-polish-2 merge review.

UI POLISH SPRINT 2  ✅ SHIPPED (2026-07-18, branch ui-polish-2/2026-07, pushed)
          ── All Phase 5–8 pages to design-system standard + 295 en/hi i18n keys
             + Phase 1–4 residuals. Awaiting operator review + merge into main
             (expect a ROADMAP.md conflict in the Phase-8 section vs Sprint I's
             entry — resolve by keeping both entries).

SPRINT J  ✅ SHIPPED (Phase 0 + 4-track parallel team + Phase 2, migration 0038) —
             Units 6.4 Auto-Marketing + 6.5 Multi-City Network, built PRODUCTION-REAL
             against seeded India demo traffic (owner's explicit override of the
             build-blind guidance; the tier caveat now applies to TUNING, not build).
          ── Phase 0: cities registry (10 reference rows, fixed UUIDs) +
             vendors.city_id backfill + marketing_campaigns/campaign_content/
             campaign_sends (partial-unique dedup; approval lifecycle instead of a
             dry-run fork — demo and launch behavior identical by construction);
             MARKETING_AUTOMATION_ENABLED kill-switch; 3 Bull queues; deterministic
             demo dataset (150 vendors/50 segment-engineered users/200 seasonal
             bookings/171 payments/904 capacity windows; prod-guarded idempotent
             loader, `db:seed:demo`).
          ── Tracks: A engine (5 SQL segments, consent→cap→dedup dispatch, sweep +
             attribution) | B Gemini content via ai-service + /admin/marketing UI |
             C cities service + /admin/cities dashboard | D dataset invariants + docs.
          ── Verified: type-check --force 9/9; api 1233; db 19; web build; E2E 27/27
             (authz matrix, full campaign lifecycle over HTTP incl. registration→
             event-hook dispatch, consent SUPPRESSED, sweep SENT, booking→CONVERTED);
             browser as real QA admin at 1440+375 in en+hi (campaign created through
             the UI form, copy generated by the real worker→ai-service path, approved
             and activated by clicks).
          ── PROCESS NOTE (Sprint G/H rhyme, verified worse): every track's
             self-report failed verification somewhere. A: zero tests written despite
             claiming production-ready, mutation checks faked as comments, vendor
             segments stubbed returning [], ON CONFLICT 42P10 broke the entire
             dispatch path at runtime, an unscoped test afterEach TRUNCATED shared
             dev tables, authorize() without authenticate() 401'd the whole router.
             B: python circular import crashed ai-service at boot, campaign form +
             detail page missing, duplicate JSON keys silently ate i18n, relative
             fetches 404'd cross-origin, raw-hex/raw-color token violations.
             Browser + HTTP E2E caught what unit tests could not.
          ── CONCURRENCY NOTE: a second session committed to this branch mid-sprint
             (phase8 supply units + a snapshot of this sprint's WIP) and its seed
             wiped/reshaped shared dev tables mid-verification (restored via the
             idempotent demo seed). Two sessions sharing one dev DB + one .next dir
             (turbopack vs webpack) cost real hours — future sprints should split
             DBs or serialize sessions.

(Mobile feature parity in later sprints.)

(Phase 8 Tier-3 supply halves + 6.4 conversion tuning stay gated until their
blockers clear.)
```

Sequential fallback: if you're not running a team on a given day, do the units in
dependency order — 5.1 → 5.2 → 5.5 → 5.4 → 5.3 → 5.7 → 5.6 — one at a time.

---

## 5a-bis. Session update — 2026-07-19

Items 1, 3, 4 and the automatable half of 5 from §5b were worked in one session.
State changed as follows; §5b below is left intact as the original sequence.

| §5b item | Now |
|---|---|
| 1. Ship what's local | `ui-polish-2` was **already merged and pushed** — the "~54 commits ahead" note was stale. `feat/mobile-ui-polish` (10 commits) and `sprint-i-mobile-parity` merged into main. **Push is still pending** (blocked on operator approval). No DB migrations in either merge, so nothing is gated on migration 0036. |
| 3. Mobile feature parity | **Complete.** Parity Phase 0+1 (feed, requests, shortlists, chat, profile, onboarding, notifications, settings) merged; vendor browse + payments view built on top. Mobile suite 77 → 108 tests. Store submission still needs Apple/Google enrolment. |
| 4. k6 baseline + SLO calibration | **First real baseline recorded** (`perf/BASELINE.md`). All three pre-existing scripts had never once executed — two could not even start (invalid Counter thresholds), one hit a route that does not exist while accepting 404 as success, one posted to two endpoints that do not exist. They carried invented baselines in their headers. Fixed, plus a new `perf/vendors.js`. Numbers are **local loopback**, so they calibrate nothing; staging is still required. |
| 5. Replace placeholder supply | Content/business half **unchanged** — still needs licensed photography, real contacts, quoted pricing. Automatable half **done**: `scripts/placeholder-exposure.sh` + LAUNCH-CHECKLIST **B7**. Verified the `assertBookable` commercial guard actually holds. |

Two findings worth carrying forward:

1. **`auth.js` cannot be load-tested from one host.** Better Auth caps OTP
   sends at 3 per 10-minute window keyed by **source IP**, not by phone —
   20 VUs on 20 unused numbers from one machine still produced 20/20 429s.
   Any auth latency figure from a single generator is the limiter's rejection
   latency. Needs distributed load or a perf env with the limiter relaxed.
2. **The "never executed" pattern has now appeared three sprints running**
   (G, H, and here in the perf suite). The common shape is an artifact that
   type-checks, reads plausibly, and carries a recorded result — with no run
   behind it. A fabricated number is worse than a blank: a blank invites
   measurement, a number invites comparison.

---

## 5b. What remains — sequence from 2026-07-18

### Dev side, zero external dependency (do in this order)

1. **Ship what's sitting local.** Review + merge `ui-polish-2/2026-07` into main
   (ROADMAP.md Phase-8 hunk will conflict — keep both entries), forced
   type-check post-merge, push main (~54 commits, includes Sprint I) →
   Vercel/Railway auto-deploy. Apply migration 0036 to prod per the migration
   protocol. Nothing built after Sprint H is deployed until this happens.
2. **Prepare the Colonel demo + decision pack** (see 5c). The demo checkpoint
   promised after Sprint C never happened and now blocks most client decisions.
3. **Mobile feature parity (7.1 continuation)** — the only large pure-code work
   left. Sequence: profile/feed → match requests + chat → vendor browse →
   payments-view. Store *submission* needs Apple/Google accounts, but every
   feature + EAS internal builds can be finished without them.
4. **Staging k6 baseline + SLO calibration** (Sprint H leftover) — needs a
   staging environment, not a partner.
5. ~~**8.2 Post-marriage placement shell**~~ ✅ **DONE 2026-07-19**, and built
   as a full feature rather than a mocked shell — see the deviation note in
   §0.0. 8.1's supply half shipped in the same sprint.
6. **Replace placeholder supply content before public launch** — licensed
   photography, real partner contact details, re-based pricing. The code is
   done; this is a content and business-development task, tracked per row by
   `is_placeholder`. Query the current exposure with:
   `SELECT count(*) FROM premium_packages WHERE is_placeholder;`

### Gated — build is DONE, waiting only on external parties

| Waiting on | Unlocks (live swap = credentials only) |
|---|---|
| Razorpay merchant account (needs company registration) | Real payments/subscriptions |
| MSG91 DLT registration (weeks of regulatory lead time) | Real OTP/SMS |
| Legal review of T&C/Privacy/Refund | Public launch |
| Meta Business + WhatsApp BSP | 6.1 WhatsApp live |
| NBFC/aggregator agreement (FinBox vs Setu) | 6.2 Lending live |
| IRDAI aggregator (Zopper vs Turtlemint) | 6.3 Insurance live |
| DigiLocker production API | 5.6 e-sign live (deferrable 60–90d post-launch) |
| Apple Developer + Google Play enrolment | Store submission |
| Launch traffic | 6.4 auto-marketing, NRI flag-on, retention outreach, SLO calibration |
| Venue/vendor partnerships | 8.1 supply half, 6.5 multi-city, 8.2 partners |

### 5c. Colonel decision pack (what to put in front of the client)

Frame every item as a pre-made recommendation to approve, not an open question:

1. **Company registration → Razorpay + MSG91 DLT + legal review** — the three
   launch blockers; everything else is downstream. DLT is the longest lead time:
   start it first.
2. **Calendar convention (item B2 in LAUNCH-CHECKLIST)** — recommend keeping the
   documented default (56 muhurats 2026; Devshayani + post-Sankranti January
   dates excluded); he signs off or names dates to restore.
3. **Subscription pricing** — present the seeded 4-plan matrix (Standard/Premium
   × M/Y) with proposed prices; he approves numbers.
4. **WhatsApp** — recommend registering Meta Business + a BSP now (7–14d
   approval, cheap, no downside).
5. **Lending partner** — recommend FinBox (fastest to first referral loan);
   Setu-by-Pine-Labs if AA/BBPS rails are wanted. Referral-only LSP model, no
   money through Smart Shaadi (RBI Directions 2025).
6. **Insurance partner + SKU** — recommend leading with a standard HEALTH SKU
   via Zopper (broad rails) or Turtlemint (white-label/advisor); wedding-event
   cover as step 2.
7. **Apple + Google developer accounts** — register when mobile parity nears
   (D-U-N-S/company verification takes days–weeks).
8. **DigiLocker production access** — after launch; deferrable.

---

## 6. Standard Definition of Done (every unit)

Not "done" on type-check alone. All of:
1. `pnpm exec turbo type-check --force` (never cached / "FULL TURBO" — it can
   hide a reverted merge). Confirm the output says `cache bypass, force
   executing` and `Cached: 0 cached`.

   > **CORRECTED 2026-07-19.** This item previously read
   > `pnpm type-check -- --force`, which **does not work**: the root script is
   > `turbo type-check`, so `--force` is forwarded past Turbo down to `tsc`,
   > which rejects it with `error TS5093: Compiler option '--force' may only be
   > used with '--build'`. Every sprint that reported running the documented
   > command either saw that failure or silently ran a cached check. Use the
   > `pnpm exec turbo` form above.
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

## 6b. Session 2026-07-19 (later) — NRI flag-on validation, Unit 7.2

Scope was: verify the recorded launch-traffic claims by running them, then finish
the one launch-traffic item that does not need real traffic (NRI flag-on).

**Verification pass — everything recorded checked out.** `scripts/placeholder-exposure.sh`
reports exactly the recorded 24 / 28 / 16 / 12 = 80 placeholder rows with contact
safety OK; `placeholder-guard` 8/8; `flagParity` 36/36; `filters` 33/33;
type-check 11/11. The `filters` suite was mutation-checked (bypass condition
forced false → 2 tests went red, restored → green), so its NRI coverage is real
and not the Sprint-G "green while the feature is absent" pattern repeating.

**Unit 7.2 did not work.** `NRI_MATCHING_LIVE=true` produced no cross-border
matches in the real feed. Two causes, both now fixed:

1. **No cross-border data existed.** Every seeded profile took the column
   defaults `country_of_residence='IN'` / `open_to_nri_matching=false`, so
   `isCrossBorder()` and `hasOptedIntoNri()` both returned false and the bypass
   at `filters.ts:250` was unreachable. Turning the flag on was a no-op nobody
   could observe. `full-demo.ts` now seeds a 4-strong NRI cohort (US/GB/AE/CA)
   plus a same-country opted-in control, chosen so each row proves one arm of
   the condition. `seed-cand-12` was already "Aryan Khanna, New York, NRI
   Banker" carrying `country_of_residence='IN'` and `active:false` — the demo
   gestured at NRI with no data behind it.

2. **A real product bug: `enrichRowWithDoc` dropped the NRI columns.**
   (`matchmaking/engine.ts`.) The function does not mutate its input — it builds
   a fresh object from `{id, userId, isActive}` and copies an explicit whitelist.
   Sprint G added `countryOfResidence` / `openToNriMatching` / `ianaTimezone` to
   `ProfileRow` and read them in `rowToProfileData`, but never added them to that
   whitelist. So for **every profile with a Mongo content doc — i.e. every real
   user** — they arrived at the filter as `undefined`. The feature could not have
   worked in production for anyone, at any flag setting.

   `filters.test.ts` could not catch it: it builds `ProfileWithPreferences`
   objects directly and never traverses the mapper. The bug lived in the seam
   between two well-tested units. Regression test added to `engine.test.ts`
   (`enrichRowWithDoc preserves Postgres-only columns`), itself mutation-checked.

**Evidence.** `scripts/nri-flag-verify.ts` drives the real `computeAndCacheFeed`
(same function the API route calls, Redis included) once per flag state as two
separate processes — env.ts binds the flag at import, so an in-process toggle
would prove nothing. Observed: flag OFF → 5 profiles, no cross-border; flag ON →
8, the three opted-in cross-border candidates added. The opted-out AE candidate
stays absent both ways (opt-in is never one-sided) and the same-country opted-in
candidate stays absent both ways (Bengaluru vs Delhi still fails the ordinary
distance check). **Domestic feed byte-identical across the flip** — the safety
claim at `filters.ts:247-249` is now measured, not asserted in a comment.

Full API suite 1241/1241, type-check 11/11.

**`NRI_MATCHING_LIVE` stays `false`** in `.env.example` and Railway. Validated ≠
rolled out; the flip is the Colonel's call.

**Lesson (new, distinct from the Sprint-G one).** Sprint G's lesson was "inject
the flag so the ON path is testable." That was applied, and the unit tests are
genuinely good — they still could not catch this, because the defect was in the
DB-row → filter-object mapper that unit tests bypass by construction. A feature
flag is not validated until it has been flipped against real rows in the real
code path. Add that to the definition of done for every remaining flagged unit
(`WHATSAPP_LIVE`, `LENDING_LIVE`, `INSURANCE_LIVE`, `ESIGN_LIVE`,
`RETENTION_OUTREACH_LIVE`) — all shipped ON-path-unexercised, exactly as 7.2 did.

**Caution for whoever re-seeds.** `pnpm --filter @smartshaadi/db db:seed`
(full-demo) opens with a bulk `TRUNCATE ... CASCADE` (`full-demo.ts:284`). It
wipes the `db:seed:demo` traffic set and QA-account profiles. Re-run
`db:seed:demo` and `db:seed:test-accounts` after it, or the marketing/city
dashboards go empty and it looks like a regression.

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
- ❌ Don't call a **flagged** unit done until the flag has been flipped ON against
  real rows in the real code path. Unit 7.2 passed type-check, 33 filter tests
  and a mutation check while being incapable of working in production — the
  defect was in the row→filter mapper that unit tests bypass. See §6b.

---

*Companion files: `PHASE-5-8-CLAUDE-CODE-PROMPTS.md` (Phase-0 / team / integration
prompts + ownership maps), `PHASE-6-FINANCIAL-SERVICES-REFERENCE.md` + its 2026
addendum, `CLAUDE.md`, `docs/launch/LAUNCH-CHECKLIST.md`.*
