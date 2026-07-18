/**
 * Wire serialization for Dynamic Pricing.
 *
 * Money.paise is a bigint (ADR-001) and `res.json()` (JSON.stringify) THROWS on
 * bigint. Every pricing payload therefore crosses the HTTP boundary with paise
 * as a decimal STRING (lossless, never a float). The web parses it back for
 * display. Keeping this at the boundary lets the domain types stay bigint-typed.
 */

import type { Money, PricingRule, PricingSuggestion } from '@smartshaadi/types';

export interface WireMoney {
  paise: string;
  currency: string;
  /** Presentation currency — how money renders (Phase 7.2 Track C, Unit 7.2). */
  displayCurrency?: string;
}

export interface WirePricingRule {
  id: string;
  profileId: string;
  serviceCategory: string;
  base: WireMoney;
  floorMultiplier: number;
  ceilingMultiplier: number;
  muhuratMultiplier: number;
  offSeasonMultiplier: number;
  demandMultiplier: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WirePricingSuggestion {
  ruleId: string;
  profileId: string;
  base: WireMoney;
  appliedFactors: Record<string, number>;
  rawMultiplier: number;
  clampedMultiplier: number;
  suggested: WireMoney;
  overridable: boolean;
  explanationEn: string;
  explanationHi: string;
}

/**
 * Serialize a Money value to wire shape for HTTP.
 *
 * @param m The Money object (paise: bigint, currency).
 * @param displayCurrency Optional presentation currency (Sprint G, Unit 7.2).
 *   Selects how the client RENDERS the amount — it never converts the value.
 *   Omitted → wire omits the field (backward compatible).
 *
 * NOTE: these serializers take a real second parameter, so they must never be
 * passed point-free to `.map()` — `arr.map(serializePricingRule)` would hand the
 * array INDEX to `displayCurrency`. Always wrap: `arr.map(r => serialize(r))`.
 * The parameter is typed `string` deliberately; widening it to `string | number`
 * to absorb a stray index would silence the type error that catches this.
 *
 * @returns WireMoney with paise as decimal string.
 */
export function serializeMoney(m: Money, displayCurrency?: string): WireMoney {
  const wire: WireMoney = {
    paise: m.paise.toString(),
    currency: m.currency,
  };
  if (displayCurrency) {
    wire.displayCurrency = displayCurrency;
  }
  return wire;
}

/**
 * Serialize a PricingRule to wire shape.
 *
 * @param r The PricingRule (domain object).
 * @param displayCurrency Optional presentation currency from the vendor's profile.
 * @returns WirePricingRule with all Money fields serialized.
 */
export function serializePricingRule(
  r: PricingRule,
  displayCurrency?: string,
): WirePricingRule {
  return {
    id: r.id,
    profileId: r.profileId,
    serviceCategory: r.serviceCategory,
    base: serializeMoney(r.base, displayCurrency),
    floorMultiplier: r.floorMultiplier,
    ceilingMultiplier: r.ceilingMultiplier,
    muhuratMultiplier: r.muhuratMultiplier,
    offSeasonMultiplier: r.offSeasonMultiplier,
    demandMultiplier: r.demandMultiplier,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Serialize a PricingSuggestion to wire shape.
 *
 * @param s The PricingSuggestion (domain object).
 * @param displayCurrency Optional presentation currency from the vendor's profile.
 * @returns WirePricingSuggestion with all Money fields serialized.
 */
export function serializePricingSuggestion(
  s: PricingSuggestion,
  displayCurrency?: string,
): WirePricingSuggestion {
  return {
    ruleId: s.ruleId,
    profileId: s.profileId,
    base: serializeMoney(s.base, displayCurrency),
    appliedFactors: s.appliedFactors,
    rawMultiplier: s.rawMultiplier,
    clampedMultiplier: s.clampedMultiplier,
    suggested: serializeMoney(s.suggested, displayCurrency),
    overridable: s.overridable,
    explanationEn: s.explanationEn,
    explanationHi: s.explanationHi,
  };
}
