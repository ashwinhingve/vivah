/**
 * Dynamic Pricing v1 — PricingAdvisor tests (the money-critical pure core).
 *
 * The advisor has NO runtime imports (types are erased), so no DB mocking is
 * needed. Covers ADR-001: formula, clamp floor/ceiling hits, integer-paise
 * rounding, overridability, and the mandatory bilingual explanation.
 */

import { describe, it, expect } from 'vitest';
import { asProfileId, type PricingRule, type Money } from '@smartshaadi/types';
import { computeSuggestion, clampMultiplier } from '../advisor.service.js';

function makeRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: overrides.id ?? 'rule-1',
    profileId: overrides.profileId ?? asProfileId('profile-1'),
    serviceCategory: overrides.serviceCategory ?? 'Photography',
    base: overrides.base ?? { paise: 100_000n, currency: 'INR' }, // ₹1,000.00
    floorMultiplier: overrides.floorMultiplier ?? 0.5,
    ceilingMultiplier: overrides.ceilingMultiplier ?? 3,
    muhuratMultiplier: overrides.muhuratMultiplier ?? 1,
    offSeasonMultiplier: overrides.offSeasonMultiplier ?? 1,
    demandMultiplier: overrides.demandMultiplier ?? 1,
    status: overrides.status ?? 'ACTIVE',
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  };
}

const f = (muhurat = 1, offSeason = 1, demand = 1) =>
  ({ MUHURAT: muhurat, OFFSEASON: offSeason, DEMAND: demand });

describe('clampMultiplier', () => {
  it('passes values inside the bounds through unchanged', () => {
    expect(clampMultiplier(1.25, 0.5, 3)).toBe(1.25);
  });
  it('raises values below the floor to the floor', () => {
    expect(clampMultiplier(0.1, 0.7, 3)).toBe(0.7);
  });
  it('caps values above the ceiling at the ceiling', () => {
    expect(clampMultiplier(5, 0.5, 2.5)).toBe(2.5);
  });
  it('is inclusive at the bounds', () => {
    expect(clampMultiplier(0.5, 0.5, 3)).toBe(0.5);
    expect(clampMultiplier(3, 0.5, 3)).toBe(3);
  });
});

describe('computeSuggestion — formula', () => {
  it('returns base unchanged when all factors are 1', () => {
    const rule = makeRule();
    const s = computeSuggestion(rule, f(1, 1, 1));
    expect(s.rawMultiplier).toBe(1);
    expect(s.clampedMultiplier).toBe(1);
    expect(s.suggested.paise).toBe(100_000n);
    expect(s.suggested.currency).toBe('INR');
  });

  it('applies a muhurat premium', () => {
    const s = computeSuggestion(makeRule(), f(1.25, 1, 1));
    expect(s.rawMultiplier).toBeCloseTo(1.25);
    expect(s.clampedMultiplier).toBeCloseTo(1.25);
    expect(s.suggested.paise).toBe(125_000n);
  });

  it('applies an off-season discount', () => {
    const s = computeSuggestion(makeRule(), f(1, 0.8, 1));
    expect(s.suggested.paise).toBe(80_000n);
  });

  it('multiplies all three factors before clamping', () => {
    // 1.2 × 0.9 × 1.1 = 1.188
    const s = computeSuggestion(makeRule(), f(1.2, 0.9, 1.1));
    expect(s.rawMultiplier).toBeCloseTo(1.188);
    expect(s.suggested.paise).toBe(118_800n);
  });
});

describe('computeSuggestion — clamp (surge guardrail)', () => {
  it('caps at the ceiling and marks the hit in the explanation', () => {
    const rule = makeRule({ ceilingMultiplier: 2.5 });
    const s = computeSuggestion(rule, f(5, 1, 1)); // raw 5 → clamped 2.5
    expect(s.rawMultiplier).toBe(5);
    expect(s.clampedMultiplier).toBe(2.5);
    expect(s.suggested.paise).toBe(250_000n);
    expect(s.explanationEn).toContain('capped at your ceiling');
  });

  it('lifts to the floor and marks the hit in the explanation', () => {
    const rule = makeRule({ floorMultiplier: 0.7 });
    const s = computeSuggestion(rule, f(1, 0.1, 1)); // raw 0.1 → clamped 0.7
    expect(s.rawMultiplier).toBeCloseTo(0.1);
    expect(s.clampedMultiplier).toBe(0.7);
    expect(s.suggested.paise).toBe(70_000n);
    expect(s.explanationEn).toContain('floor');
  });

  it('never emits a price outside the vendor bounds regardless of factors', () => {
    const rule = makeRule({ floorMultiplier: 0.8, ceilingMultiplier: 1.5 });
    const high = computeSuggestion(rule, f(9, 9, 9));
    const low = computeSuggestion(rule, f(0.01, 0.01, 0.01));
    expect(high.suggested.paise).toBe(150_000n); // base × 1.5
    expect(low.suggested.paise).toBe(80_000n); // base × 0.8
  });
});

describe('computeSuggestion — rounding (integer paise only)', () => {
  it('rounds to whole paise, never fractional', () => {
    const rule = makeRule({ base: { paise: 999n, currency: 'INR' } });
    const s = computeSuggestion(rule, f(1.005, 1, 1)); // 999 × 1.005 = 1003.995
    expect(s.suggested.paise).toBe(1004n);
    expect(typeof s.suggested.paise).toBe('bigint');
  });

  it('produces a clean integer for large bases', () => {
    const rule = makeRule({ base: { paise: 50_000_00n, currency: 'INR' } }); // ₹50,000
    const s = computeSuggestion(rule, f(1.15, 1, 1));
    expect(s.suggested.paise).toBe(5_750_000n);
  });
});

describe('computeSuggestion — contract', () => {
  it('is always overridable and echoes the applied factors', () => {
    const factors = f(1.25, 0.9, 1.1);
    const s = computeSuggestion(makeRule(), factors);
    expect(s.overridable).toBe(true);
    expect(s.appliedFactors).toEqual(factors);
    expect(s.ruleId).toBe('rule-1');
  });

  it('carries the base currency onto the suggestion', () => {
    const rule = makeRule({ base: { paise: 100_000n, currency: 'USD' } as Money });
    const s = computeSuggestion(rule, f(1.2, 1, 1));
    expect(s.suggested.currency).toBe('USD');
  });

  it('always returns a non-empty bilingual explanation', () => {
    const s = computeSuggestion(makeRule(), f(1.25, 0.9, 1.2));
    expect(s.explanationEn.length).toBeGreaterThan(0);
    expect(s.explanationHi.length).toBeGreaterThan(0);
    expect(s.explanationEn).toContain('muhurat');
    expect(s.explanationHi).toContain('मुहूर्त');
  });

  it('explains a no-adjustment price plainly', () => {
    const s = computeSuggestion(makeRule(), f(1, 1, 1));
    expect(s.explanationEn).toContain('no adjustments');
  });
});
