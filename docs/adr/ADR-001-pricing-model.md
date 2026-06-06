# ADR-001 — Dynamic Pricing v1 model

- **Status:** Accepted (Phase 5, Tier 0 contracts)
- **Date:** 2026-06-06
- **Context contracts:** `packages/types/src/pricing.ts`,
  `packages/schemas/src/pricing.ts`, table `pricing_rules`
  (`packages/db/schema/phase5.ts`)

## Context

Phase 5 routes idle vendor capacity to off-season events and lets vendors price
dynamically. Pricing must (a) lift price for high-demand muhurat dates, (b)
discount off-season to fill idle capacity, and (c) **never read as surge** — the
top risk called out in the phases-5-8 master plan. It must be deterministic,
explainable, and always vendor-overridable. It is a **plain service**
(`PricingAdvisor`), not an LLM agent.

## Decision

The suggested price is a deterministic function of a vendor-set base and three
bounded multipliers, hard-clamped to vendor-set bounds:

```
raw      = muhurat × offSeason × demand
clamped  = clamp(raw, floorMultiplier, ceilingMultiplier)
suggested.paise = round( base.paise × clamped )
```

- **`base`** — `Money` (bigint paise + currency). Vendor-set per service category.
- **`floorMultiplier` / `ceilingMultiplier`** — vendor-set clamp bounds. The
  suggestion can NEVER exit `[base×floor, base×ceiling]`, regardless of factors.
  This is the surge guardrail.
- **`muhuratMultiplier`** (≥ 1) — applied when the event date hits a muhurat
  (from `calendar_events`, kind `MUHURAT`, weighted by `auspicious_band`).
- **`offSeasonMultiplier`** (≤ 1) — applied when the date falls outside peak
  season / in a `BLACKOUT` window (e.g. Chaturmas). Drives fill-the-gap discounts.
- **`demandMultiplier`** — live signal (recent lead/booking density for the
  vendor's category + region). Bounded like the others.

All multipliers are dimensionless `double precision`, defaulting to `1`
(price = base). Persisted on `pricing_rules`; money on `base_paise` + `currency`.

## Output contract (`PricingSuggestion`)

The advisor returns, and the UI MUST render:
- `base`, `appliedFactors` (the three multipliers actually used),
- `rawMultiplier` (pre-clamp) and `clampedMultiplier` (post-clamp — so a clamp
  hit is visible),
- `suggested` (`Money`),
- `overridable: true` — the vendor can always set a different final price,
- `explanationEn` / `explanationHi` — plain-language reason
  ("Diwali muhurat +25%, clamped to your ceiling") in both languages.

## Constraints for the build agent

1. **Clamp is mandatory and last.** Never emit a price outside the vendor bounds.
2. **Rounding** is on paise (integer); never store fractional paise.
3. **Always overridable.** The suggestion is advice; the vendor's set price wins.
4. **Bilingual explanation is required**, not optional — transparency is the
   anti-surge mechanism.
5. **Deterministic.** Same inputs → same output. No randomness, no LLM in the
   pricing path. (An LLM may later *phrase* the explanation, but never compute
   the number.)
6. **Currency.** v1 settles INR; `base.currency` is carried for Phase 7 display.

## Consequences

- Predictable, auditable pricing vendors can reason about and override.
- Bounds + transparent explanation defuse the "surge pricing" perception risk.
- Factor sourcing (muhurat band weights, demand window) is the Pricing build
  tier's job; this ADR fixes the formula shape and the output contract so that
  work implements to spec.
