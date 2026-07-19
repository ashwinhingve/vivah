# Muhurat Calendar — Panchang Conventions & Open Authority Decisions

> Phase 5 Tier 1. The vivah muhurat dataset
> (`packages/db/seed/data/calendar-2026-2027.json`) depends on **panchang
> convention** (smarta vs vaishnava reckoning, which Ekadashi anchors Chaturmas).
> Reasonable authorities disagree — this is a tradition/lineage question, **not a
> fact a second source can settle**. The decisions below belong to the panchang
> authority the platform stands behind (**Colonel Deepak**), not to engineering.

## How the dataset was verified

- Primary source: **Drik Panchang** 2026/2027 shubh-vivah lists.
- Independent cross-check (per pre-prod-seed verification): **ProKerala**
  (structured), with directional corroboration from AstroSage / mPanchang.
- Result: of ProKerala's 39 curated 2026 dates, **21 exactly matched** ours; the
  bulk Feb–Jun + Nov–Dec season reconciled. Two **structural disagreements**
  surfaced — both convention-driven, isolated below.

## Decision applied now

### Q2 Resolution (July 2026) — Colonel's authority ruling

**January post-Sankranti muhurats are ADMITTED with region="South India" tag.**

The 4 dates (Jan 14/23/25/28) are legitimate in South Indian tradition (ProKerala)
but prohibited in North Indian tradition (Kharmas/Dhanurmas — Drik/mPanchang omit).
This is not a factual disagreement; it is a **regional/tradition split**. Rather than
show North Indian families dates their pandit will reject (unrecoverable trust loss on
our core feature), the muhurats are region-tagged. A North Indian user querying
`?region=North%20India` or (when profile region is implemented) filtering by their
region will not see these dates. A South Indian user will.

| Panchang | January 2026 muhurats | Reason |
|---|---|---|
| **ProKerala** | 4 dates (Jan 14/23/25/28) | Post-Makar-Sankranti (South Indian tradition) |
| **Drik/mPanchang** | 0 dates | Kharmas / Dhanurmas period (North Indian tradition blocks) |

**Sourced panchang values (ProKerala):**

| Date | Tithi | Nakshatra | Window (IST) |
|---|---|---|---|
| 2026-01-14 | Ekadashi | Anuradha | 19:55 → 03:03 next day |
| 2026-01-23 | Navami | Uttara Bhadrapada | 15:58 → 01:46 next day |
| 2026-01-25 | Ekadashi | Revati | 06:14 → 13:35 |
| 2026-01-28 | Dashami | Rohini | 09:26 → 23:53 |

**Region filtering infrastructure (fail-safe):**

The muhurats are **admitted** (`convention: "include"`) but **filtered by region** at query time.
- Muhurats tagged `region: "South India"` are seeded in the database.
- **Disputed muhurat filtering is fail-safe, not fail-open:**
  - Caller's region **unknown** (not specified): January muhurats **EXCLUDED**
  - Caller's region **= "South India"**: January muhurats **INCLUDED** + national dates
  - Caller's region **= "North India"** (or any other): January muhurats **EXCLUDED**, national only
- Non-muhurat events (FESTIVAL, SCHOOL) follow national-inclusive: a Tamil Nadu user sees Pongal + national festivals, regardless of region specification.
- **Current limitation:** Region filtering is query-param only (`?region=X`). Automatic profile-based filtering is NOT implemented — **NO CALLER PASSES A REGION TODAY**, so it functions as fail-safe default (excludes regional disputed).
- **Future (Phase 6+):** When user profile stores region preference, the filtering becomes automatic per-user.

**Why fail-safe, not fail-open?**
- Showing a Kharmas date to a North Indian family → they book it → their pandit refuses → trust destroyed on our core feature. Unrecoverable.
- Hiding a valid date from a South Indian family → they choose another date → invisible, recovered when they set their tradition.

---

### Earlier decision (conservative baseline)

Showing a wedding date another major panchang calls **Chaturmas/blocked** was the
unrecoverable failure. Omitting a legitimate date was recoverable and invisible. The
conservative side (hold out, wait for ruling) was the safe default. Seeded today:

| Kind | Count | Notes |
|------|------:|-------|
| MUHURAT | 152 | 56 (2026) + 96 (2027); the disputed July/Jan dates are held out |
| FESTIVAL | 56 | 32 national + 24 regional/community variants |
| GOVT | 6 | national gazetted holidays |
| SCHOOL | 4 | CBSE board-exam 2026/2027 + Delhi summer/winter break (date→endDate) |
| **Total** | **218** | additive, idempotent re-seed |

The disputed dates are **encoded, not deleted** — see `disputed` in the JSON.

## The `conventions` config — one-line rulings

Resolution is now a **single config flip + re-seed**, not a data hunt. The dataset
carries a top-level `conventions` block; each `disputed` bucket declares the
convention key (`gatedBy`) and the value that promotes it. Both readers honour it —
`packages/db/seed/calendar.ts` (via `calendar-data.ts`) and
`apps/ai-service/src/services/calendar_service.py`.

| Convention key | Default | Other value(s) | Meaning |
|---|---|---|---|
| `devshayani` | `amanta-6jul` | `drik-25jul` | Admit (or omit) the 4 July muhurats `2026-07-01/06/11/12` (Q1). Filtered by `region` query param. |
| `january_post_sankranti` | **`include`** (Q2 RESOLVED) | `omit` | Admit (or omit) the 4 Jan muhurats `2026-01-14/23/25/28`. **NOT "show to everyone"** — admission is region-tagged. Filtered by `?region=X`: South India sees them, others don't. |
| `vishu_day` | `unset` | `apr-14` \| `apr-15` | Vishu festival date for Kerala (Q3). National-inclusive: Kerala sees it, others see national only. |
| `onam_reckoning` | `unset` | `aug-26` \| `sep-01` | Onam/Thiruvonam date for Kerala (Q3). National-inclusive. |

To enact a ruling: set the value in `conventions`, run `db:seed:calendar`
(additive — only the newly-admitted rows insert), and update the count assertions
in `apps/ai-service/tests/test_calendar.py` if the live count changes. Note the
Chaturmas anchor (`chaturmas.<year>.devshayani`) is a **separate** field and is
left untouched; `devshayani` here gates only muhurat admission, not the blackout
boundary (the 4 July dates all precede 25-Jul, so they never violate the guard).

## OPEN — for Colonel Deepak (panchang-authority decisions)

### Q1 — Devshayani Ekadashi convention (the July cluster)
Drik places **Devshayani Ekadashi = 25-Jul-2026** → Jul 1–12 are valid wedding
days. Two other sources start Chaturmas **~6-Jul** → those days are blocked.

- **Held out (4):** `2026-07-01`, `2026-07-06`, `2026-07-11`, `2026-07-12` —
  not independently corroborated.
- **Kept (1):** `2026-07-07` — independently corroborated (ProKerala).
- **Flip:** `conventions.devshayani` → `drik-25jul` restores the 4.

### Q2 — January post-Sankranti dates (Kharmas end)
Drik + mPanchang list **zero** January 2026 muhurats (Kharmas / Dhanurmas).
ProKerala includes four post-Makar-Sankranti dates.

- **Omitted (4):** `2026-01-14`, `2026-01-23`, `2026-01-25`, `2026-01-28`.
- **Flip:** `conventions.january_post_sankranti` → `include`. NB: these dates have
  no sourced tithi/nakshatra yet — source them before relying on the promoted rows.

### Q3 — Regional reckoning (Vishu / Onam, Kerala)
- **Vishu:** Medam Sankranti timing splits sources `apr-14` vs `apr-15`
  (Vishukkani next-day rule). **Flip:** `conventions.vishu_day` → the chosen date.
- **Onam (Thiruvonam):** majority/Drik list `aug-26`; some list `sep-01`
  (6-day Thiruvonam-nakshatra delta). **Flip:** `conventions.onam_reckoning`.

## Completeness — sourced additions (not authority decisions)

These are deterministic, ≥2-source-verified, and seeded now (no ruling needed):

- **SCHOOL windows** (`schoolWindows` in the JSON, `kind=SCHOOL`, `date→endDate`):
  CBSE board exams 2026 (`2026-02-17`→`2026-04-10`) and 2027 (`2027-02-15`→
  `2027-04-10`), Delhi summer break (`2026-05-11`→`2026-06-30`), Delhi winter
  break (`2026-01-01`→`2026-01-15`). Each row carries `metadata.sources`.
- **Held pending sourcing** (in `disputed`, NOT seeded — never invented):
  `schoolPendingAuthority` (2027 Delhi summer/winter dates not yet published) and
  `observancesPendingAuthority` (moon-sighting Islamic dates — Muharram,
  Milad-un-Nabi). The date-stable major observances (Eid ul-Fitr/Adha, Guru Nanak
  Jayanti, Mahavir Jayanti, Buddha Purnima, Christmas, Good Friday, Janmashtami)
  are already in `festivals[]`.

## On resolution

Prefer the **config flip** above. The legacy generator
`packages/db/seed/data/build-calendar-dataset.mjs` is kept in sync for provenance,
but the committed JSON is the runtime source of truth — editing `conventions` +
re-seeding is all a ruling requires. Do **not** silently delete a disagreement —
keep it encoded in `disputed`.
