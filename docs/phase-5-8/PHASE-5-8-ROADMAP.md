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
| 6.1 | **WhatsApp Business** | 2 | ⇉ | Meta/BSP integration behind flag + mock; Bull queue, never sync. | Meta Business + BSP approval (7–14 d) |
| 6.2 | **Lending placement shell** | 3 | ⇉ (shared referral model in Phase 0) | Placement UX + consent/KFS copy + referral→disbursal→commission model, **mock only**. Read the fin-services ref + its **2026 addendum** (RBI Directions 2025 replaced the 2022 guidelines). | NBFC/aggregator agreement + RBI DLG compliance |
| 6.3 | **Insurance placement shell** | 3 | ⇉ (shared referral model in Phase 0) | Placement UX + disclosure/opt-in + referral→policy→commission, **mock only**. Lead with a standard SKU (health/life/travel); wedding cover is niche. | IRDAI insurer/aggregator agreement |
| 6.4 | **Auto-marketing engine** | 3 | — | Do **not** build blind — needs real conversion data. | Real launch traffic |
| 6.5 | **Multi-city vendor network** | 3 | — | City-scoped admin + density. | Real vendor density >1 city |

### Phase 7 — Mobile + NRI

| # | Unit | Tier | Par | Note | Blocker |
|---|---|---|---|---|---|
| 7.1 | **React Native + Expo app** | 2 | (internal team-split, see prompts) | **Weeks of real work — NOT "90% reuse."** Auth is session cookies, not JWT. | Apple Developer + Google Play enrolment |
| 7.2 | **NRI / international matching** | 2 | ⇉ | Timezone, currency, cross-border profiles. | go-live gated on launch validation |
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

SPRINT D  ── Phase 0: shared referral→commission model (single agent). Commit.
          ── Phase 1 team (disjoint):  A:6.1 WhatsApp(flag) | B:6.2 Lending shell(mock) | C:6.3 Insurance shell(mock)
          ── register BSP / gather partner terms in parallel (Colonel session)

── Phase 7 begins only after launch validation ──
SPRINT E  ── 7.1 Mobile scaffold (internal team-split, weeks of real work)
             + 7.2 NRI ⇉ / 7.3 Virtual Date ⇉ in later sprints.

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
