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

## Decision applied now (asymmetric-risk, conservative)

Showing a wedding date another major panchang calls **Chaturmas/blocked** is the
unrecoverable failure (a family acts, their pandit rejects it, trust burned on our
core competency). Omitting a legitimate date is recoverable and invisible. So
until an authority rules, we take the conservative side:

- **Seeded 2026 muhurats: 56** (trimmed from 60). Seeded total = **190 rows**
  (MUHURAT 152 = 56 + 96, FESTIVAL 32, GOVT 6).
- The disputed dates are **encoded, not deleted** — see `disputed` in the JSON.

## OPEN — for Colonel Deepak (panchang-authority decisions)

### Q1 — Devshayani Ekadashi convention (the July cluster)
Drik places **Devshayani Ekadashi = 25-Jul-2026** → Jul 1–12 are valid wedding
days. Two other sources start Chaturmas **~6-Jul** → those days are blocked.

- **Held out (4):** `2026-07-01`, `2026-07-06`, `2026-07-11`, `2026-07-12` —
  not independently corroborated.
- **Kept (1):** `2026-07-07` — independently corroborated (ProKerala).
- **Decision needed:** Does Smart Shaadi follow Drik's 25-Jul reading (restore the
  4) or the 6-Jul camp (leave them out, and reconsider whether 07-Jul stays)?

### Q2 — January post-Sankranti dates (Kharmas end)
Drik + mPanchang list **zero** January 2026 muhurats (Kharmas / Dhanurmas).
ProKerala includes four post-Makar-Sankranti dates.

- **Omitted (4):** `2026-01-14`, `2026-01-23`, `2026-01-25`, `2026-01-28`.
- **Decision needed:** Does our tradition admit post-Sankranti January weddings?
  If yes, add these four.

## On resolution

Both are one-line rulings. When decided, edit
`packages/db/seed/data/build-calendar-dataset.mjs` (move dates between the seeded
arrays and the `DISPUTED_MUHURATS` / `OMITTED_JANUARY` blocks), regenerate the
JSON, update the count assertions in `apps/ai-service/tests/test_calendar.py`, and
re-seed. Do **not** silently delete the disagreement — keep it encoded.
