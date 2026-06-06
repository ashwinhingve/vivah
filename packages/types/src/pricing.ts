// packages/types/src/pricing.ts
//
// Dynamic Pricing v1 contracts — Phase 5 P0.
// Deterministic, vendor-overridable. See docs/adr/ADR-001-pricing-model.md for
// the formula:  suggested = clamp(base × muhurat × offSeason × demand, floor, ceil)
// The PricingAdvisor is a PLAIN SERVICE (not an LLM agent) built in a later tier.

import type { ProfileId } from './profile.js'
import type { Money } from './money.js'

export const PricingFactor = {
  MUHURAT:   'MUHURAT',
  OFFSEASON: 'OFFSEASON',
  DEMAND:    'DEMAND',
} as const
export type PricingFactor = typeof PricingFactor[keyof typeof PricingFactor]

export const PricingRuleStatus = {
  ACTIVE:   'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const
export type PricingRuleStatus = typeof PricingRuleStatus[keyof typeof PricingRuleStatus]

/**
 * Vendor-set base price + multiplier bounds for one service category.
 * Multipliers are dimensionless; `base` carries the currency.
 */
export interface PricingRule {
  id:                  string
  profileId:           ProfileId   // owning vendor's profile
  serviceCategory:     string
  base:                Money
  floorMultiplier:     number      // clamp lower bound (e.g. 0.7)
  ceilingMultiplier:   number      // clamp upper bound (e.g. 2.5)
  muhuratMultiplier:   number      // applied when date hits a muhurat (>= 1)
  offSeasonMultiplier: number      // applied off-season (<= 1)
  demandMultiplier:    number      // live demand signal
  status:              PricingRuleStatus
  createdAt:           string
  updatedAt:           string
}

/**
 * Deterministic advisor output. Always overridable by the vendor; the UI must
 * render `explanationEn` / `explanationHi` so pricing is never read as surge.
 */
export interface PricingSuggestion {
  ruleId:            string
  profileId:         ProfileId
  base:              Money
  appliedFactors:    Record<PricingFactor, number>
  rawMultiplier:     number   // product of factors, pre-clamp
  clampedMultiplier: number   // after floor/ceiling clamp
  suggested:         Money
  overridable:       true
  explanationEn:     string
  explanationHi:     string
}
