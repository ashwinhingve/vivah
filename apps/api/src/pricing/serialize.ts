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

export function serializeMoney(m: Money): WireMoney {
  return { paise: m.paise.toString(), currency: m.currency };
}

export function serializePricingRule(r: PricingRule): WirePricingRule {
  return {
    id: r.id,
    profileId: r.profileId,
    serviceCategory: r.serviceCategory,
    base: serializeMoney(r.base),
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

export function serializePricingSuggestion(s: PricingSuggestion): WirePricingSuggestion {
  return {
    ruleId: s.ruleId,
    profileId: s.profileId,
    base: serializeMoney(s.base),
    appliedFactors: s.appliedFactors,
    rawMultiplier: s.rawMultiplier,
    clampedMultiplier: s.clampedMultiplier,
    suggested: serializeMoney(s.suggested),
    overridable: s.overridable,
    explanationEn: s.explanationEn,
    explanationHi: s.explanationHi,
  };
}
