/**
 * Dynamic Pricing v1 — PricingAdvisor (pure deterministic core)
 *
 * Implements the ADR-001 formula EXACTLY (docs/adr/ADR-001-pricing-model.md):
 *
 *   raw     = muhurat × offSeason × demand
 *   clamped = clamp(raw, floorMultiplier, ceilingMultiplier)   ← mandatory, LAST
 *   suggested.paise = round( base.paise × clamped )            ← integer paise only
 *
 * This module is a PLAIN function — no DB, no Date.now(), no randomness, NO LLM
 * (ADR constraint 5). Same inputs → same output, so it is trivially unit-testable.
 * Factor sourcing (which multipliers actually apply for a date) lives in
 * factors.service.ts; this module only combines + clamps + explains.
 */

import type { Money, PricingRule, PricingSuggestion, PricingFactor } from '@smartshaadi/types';

/** Optional human labels for the applied factors, used only to enrich the
 *  bilingual explanation (e.g. "Diwali muhurat (PEAK)"). Never affects the number. */
export interface FactorLabels {
  muhurat?: string | null;
  offSeason?: string | null;
  demand?: string | null;
}

/** Hard clamp — the surge guardrail. The result can NEVER exit [floor, ceiling]. */
export function clampMultiplier(raw: number, floor: number, ceiling: number): number {
  if (raw < floor) return floor;
  if (raw > ceiling) return ceiling;
  return raw;
}

/** Percentage delta of a multiplier from 1 (e.g. 1.25 → 25, 0.9 → -10). */
function pct(multiplier: number): number {
  return Math.round((multiplier - 1) * 100);
}

/** Format integer paise as a display rupee string (₹). Web/API string, not a PDF. */
function formatInr(paise: bigint, currency: Money['currency']): string {
  const rupees = Number(paise) / 100;
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

interface Explanation {
  en: string;
  hi: string;
}

/**
 * Build the mandatory bilingual, plain-language reason. Transparency IS the
 * anti-surge mechanism (ADR constraint 4) — this is never optional.
 */
function buildExplanation(
  rule: PricingRule,
  factors: Record<PricingFactor, number>,
  suggested: Money,
  rawMultiplier: number,
  clampedMultiplier: number,
  labels: FactorLabels,
): Explanation {
  const enParts: string[] = [];
  const hiParts: string[] = [];

  if (factors.MUHURAT > 1) {
    const tag = labels.muhurat ? ` (${labels.muhurat})` : '';
    enParts.push(`muhurat${tag} +${pct(factors.MUHURAT)}%`);
    hiParts.push(`मुहूर्त +${pct(factors.MUHURAT)}%`);
  }
  if (factors.OFFSEASON < 1) {
    const tag = labels.offSeason ? ` (${labels.offSeason})` : '';
    enParts.push(`off-season${tag} −${Math.abs(pct(factors.OFFSEASON))}%`);
    hiParts.push(`ऑफ-सीज़न −${Math.abs(pct(factors.OFFSEASON))}%`);
  }
  if (factors.DEMAND > 1) {
    enParts.push(`demand +${pct(factors.DEMAND)}%`);
    hiParts.push(`मांग +${pct(factors.DEMAND)}%`);
  } else if (factors.DEMAND < 1) {
    enParts.push(`low demand −${Math.abs(pct(factors.DEMAND))}%`);
    hiParts.push(`कम मांग −${Math.abs(pct(factors.DEMAND))}%`);
  }

  const baseStr = formatInr(rule.base.paise, rule.base.currency);
  const suggStr = formatInr(suggested.paise, suggested.currency);

  // Clamp visibility — a hit must be legible so vendors trust the bound.
  let clampEn = '';
  let clampHi = '';
  if (clampedMultiplier < rawMultiplier) {
    clampEn = ` capped at your ceiling (×${rule.ceilingMultiplier})`;
    clampHi = ` आपकी अधिकतम सीमा (×${rule.ceilingMultiplier}) पर सीमित`;
  } else if (clampedMultiplier > rawMultiplier) {
    clampEn = ` lifted to your floor (×${rule.floorMultiplier})`;
    clampHi = ` आपकी न्यूनतम सीमा (×${rule.floorMultiplier}) तक बढ़ाया गया`;
  }

  const en = enParts.length === 0
    ? `Base ${baseStr}, no adjustments. Suggested ${suggStr}.${clampEn}`
    : `Base ${baseStr}. ${enParts.join(', ')}. Suggested ${suggStr}.${clampEn}`;
  const hi = hiParts.length === 0
    ? `आधार ${baseStr}, कोई बदलाव नहीं। सुझाव ${suggStr}।${clampHi}`
    : `आधार ${baseStr}। ${hiParts.join(', ')}। सुझाव ${suggStr}।${clampHi}`;

  return { en, hi };
}

/**
 * Compute the deterministic pricing suggestion for a rule + resolved factors.
 * The vendor can ALWAYS override the result (overridable: true) — it is advice.
 */
export function computeSuggestion(
  rule: PricingRule,
  appliedFactors: Record<PricingFactor, number>,
  labels: FactorLabels = {},
): PricingSuggestion {
  const rawMultiplier =
    appliedFactors.MUHURAT * appliedFactors.OFFSEASON * appliedFactors.DEMAND;

  const clampedMultiplier = clampMultiplier(
    rawMultiplier,
    rule.floorMultiplier,
    rule.ceilingMultiplier,
  );

  // Rounding is on integer paise — never store fractional paise (ADR constraint 2).
  const suggestedPaise = BigInt(Math.round(Number(rule.base.paise) * clampedMultiplier));
  const suggested: Money = { paise: suggestedPaise, currency: rule.base.currency };

  const { en, hi } = buildExplanation(
    rule,
    appliedFactors,
    suggested,
    rawMultiplier,
    clampedMultiplier,
    labels,
  );

  return {
    ruleId: rule.id,
    profileId: rule.profileId,
    base: rule.base,
    appliedFactors,
    rawMultiplier,
    clampedMultiplier,
    suggested,
    overridable: true,
    explanationEn: en,
    explanationHi: hi,
  };
}
