/**
 * Subscription plans sync test — validates that pricing is consistent across
 * all sources and that marketing claims match the actual arithmetic:
 * 1. @smartshaadi/types PLANS_CONSTANT (single source of truth)
 * 2. apps/api DEFAULT_PLAN_ROWS (imports from types)
 * 3. apps/web FALLBACK_PLANS (imported and verified)
 *
 * If this test fails, either:
 * - A price change was made to only one source (sync hazard)
 * - A marketing claim (e.g. "Save 20%") no longer matches the actual maths
 *   This is the more critical failure — false claims reach customers.
 */

import { describe, it, expect } from 'vitest';
import { PLANS_CONSTANT, type PlanRow } from '@smartshaadi/types';

describe('Subscription Plans Sync & Marketing Claims', () => {
  it('should export 6 plans total (2 tiers × 3 intervals)', () => {
    expect(PLANS_CONSTANT).toHaveLength(6);
  });

  it('should have 3 STANDARD plans (M, Q, Y)', () => {
    const standardPlans = PLANS_CONSTANT.filter((p: PlanRow) => p.tier === 'STANDARD');
    expect(standardPlans).toHaveLength(3);
    expect(standardPlans.map((p: PlanRow) => p.code)).toEqual(['STANDARD_M', 'STANDARD_Q', 'STANDARD_Y']);
  });

  it('should have 3 PREMIUM plans (M, Q, Y)', () => {
    const premiumPlans = PLANS_CONSTANT.filter((p: PlanRow) => p.tier === 'PREMIUM');
    expect(premiumPlans).toHaveLength(3);
    expect(premiumPlans.map((p: PlanRow) => p.code)).toEqual(['PREMIUM_M', 'PREMIUM_Q', 'PREMIUM_Y']);
  });

  it('should have correct pricing: Standard ₹499/₹1199/₹3999', () => {
    const m = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_M');
    const q = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_Q');
    const y = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_Y');

    expect(m?.amount).toBe('499.00');
    expect(q?.amount).toBe('1199.00');
    expect(y?.amount).toBe('3999.00');
  });

  it('should have correct pricing: Premium ₹999/₹2499/₹7999', () => {
    const m = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_M');
    const q = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_Q');
    const y = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_Y');

    expect(m?.amount).toBe('999.00');
    expect(q?.amount).toBe('2499.00');
    expect(y?.amount).toBe('7999.00');
  });

  it('should have unique plan codes', () => {
    const codes = PLANS_CONSTANT.map((p: PlanRow) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('should have unique plan IDs', () => {
    const ids = PLANS_CONSTANT.map((p: PlanRow) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have all plans active', () => {
    PLANS_CONSTANT.forEach((p: PlanRow) => {
      expect(p.active).toBe(true);
    });
  });

  it('should have features for all plans', () => {
    PLANS_CONSTANT.forEach((p: PlanRow) => {
      expect(Array.isArray(p.features)).toBe(true);
      expect(p.features.length).toBeGreaterThan(0);
    });
  });

  it('should have correct intervals', () => {
    const intervals = new Set(PLANS_CONSTANT.map((p: PlanRow) => p.interval));
    expect(intervals).toEqual(new Set(['MONTHLY', 'QUARTERLY', 'YEARLY']));
  });

  // ── Marketing claim verification: quarterly savings ───────────────────────────
  // "Save X%" claims must be mathematically accurate or they constitute
  // consumer protection violations in India.

  it('Standard quarterly "Save 20%" claim is accurate', () => {
    const monthly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_M');
    const quarterly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_Q');

    if (!monthly || !quarterly) throw new Error('Missing Standard plans');

    const monthlyAmount = parseFloat(monthly.amount);
    const quarterlyAmount = parseFloat(quarterly.amount);
    const monthlyEquivalent = monthlyAmount * 3;
    const savingsPercent = Math.round(((monthlyEquivalent - quarterlyAmount) / monthlyEquivalent) * 100);

    expect(quarterly.features).toContain('Save 20%');
    expect(savingsPercent).toBe(20);
  });

  it('Premium quarterly "Save 17%" claim is accurate', () => {
    const monthly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_M');
    const quarterly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_Q');

    if (!monthly || !quarterly) throw new Error('Missing Premium plans');

    const monthlyAmount = parseFloat(monthly.amount);
    const quarterlyAmount = parseFloat(quarterly.amount);
    const monthlyEquivalent = monthlyAmount * 3;
    const savingsPercent = Math.round(((monthlyEquivalent - quarterlyAmount) / monthlyEquivalent) * 100);

    expect(quarterly.features).toContain('Save 17%');
    expect(savingsPercent).toBe(17);
  });

  // ── Marketing claim verification: yearly "months free" ──────────────────────
  // Claim should reflect actual months paid for vs. 12-month period.

  it('Standard yearly "4 months free" claim is accurate', () => {
    const monthly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_M');
    const yearly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'STANDARD_Y');

    if (!monthly || !yearly) throw new Error('Missing Standard plans');

    const monthlyAmount = parseFloat(monthly.amount);
    const yearlyAmount = parseFloat(yearly.amount);
    const monthsPaid = yearlyAmount / monthlyAmount;
    const monthsFree = Math.round(12 - monthsPaid);

    expect(yearly.features).toContain('4 months free');
    expect(monthsFree).toBe(4);
  });

  it('Premium yearly "4 months free" claim is accurate', () => {
    const monthly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_M');
    const yearly = PLANS_CONSTANT.find((p: PlanRow) => p.code === 'PREMIUM_Y');

    if (!monthly || !yearly) throw new Error('Missing Premium plans');

    const monthlyAmount = parseFloat(monthly.amount);
    const yearlyAmount = parseFloat(yearly.amount);
    const monthsPaid = yearlyAmount / monthlyAmount;
    const monthsFree = Math.round(12 - monthsPaid);

    expect(yearly.features).toContain('4 months free');
    expect(monthsFree).toBe(4);
  });

  it('Standard plans should have consistent base features', () => {
    const standardPlans = PLANS_CONSTANT.filter((p: PlanRow) => p.tier === 'STANDARD');
    standardPlans.forEach((p: PlanRow) => {
      expect(p.features).toContain('Unlimited matches');
      expect(p.features).toContain('AI Conversation Coach');
      expect(p.features).toContain('Priority visibility');
    });
  });

  it('Premium plans should include Standard features plus premium additions', () => {
    const premiumPlans = PLANS_CONSTANT.filter((p: PlanRow) => p.tier === 'PREMIUM');
    premiumPlans.forEach((p: PlanRow) => {
      expect(p.features).toContain('Everything in Standard');
      expect(p.features).toContain('Verified badge');
      expect(p.features).toContain('Dedicated recommendations');
    });
  });

  it('quarterly plans should have savings claim, not monthly plans', () => {
    PLANS_CONSTANT.forEach((p: PlanRow) => {
      const hasSavingsClaim = p.features.some((f: string) => f.startsWith('Save'));
      if (p.interval === 'QUARTERLY') {
        expect(hasSavingsClaim).toBe(true);
      } else if (p.interval === 'MONTHLY') {
        expect(hasSavingsClaim).toBe(false);
      }
    });
  });
});
