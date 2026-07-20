import { describe, it, expect } from 'vitest';
import { monthlySavings, PLANS_CONSTANT } from '../plans';

describe('monthlySavings', () => {
  it('returns null for monthly plans', () => {
    const monthlyPlan = PLANS_CONSTANT.find((p) => p.code === 'STANDARD_M')!;
    const result = monthlySavings(monthlyPlan, PLANS_CONSTANT);
    expect(result).toBeNull();
  });

  it('calculates savings for STANDARD_Q correctly', () => {
    const plan = PLANS_CONSTANT.find((p) => p.code === 'STANDARD_Q')!;
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).not.toBeNull();
    expect(result!.savedAmount).toBe(298);
    expect(result!.percent).toBe(20);
  });

  it('calculates savings for STANDARD_Y correctly', () => {
    const plan = PLANS_CONSTANT.find((p) => p.code === 'STANDARD_Y')!;
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).not.toBeNull();
    expect(result!.savedAmount).toBe(1989);
    expect(result!.percent).toBe(33);
  });

  it('calculates savings for PREMIUM_Q correctly', () => {
    const plan = PLANS_CONSTANT.find((p) => p.code === 'PREMIUM_Q')!;
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).not.toBeNull();
    expect(result!.savedAmount).toBe(498);
    expect(result!.percent).toBe(17);
  });

  it('calculates savings for PREMIUM_Y correctly', () => {
    const plan = PLANS_CONSTANT.find((p) => p.code === 'PREMIUM_Y')!;
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).not.toBeNull();
    expect(result!.savedAmount).toBe(3989);
    expect(result!.percent).toBe(33);
  });

  it('returns null if monthly counterpart is missing', () => {
    const plan = PLANS_CONSTANT.find((p) => p.code === 'STANDARD_Q')!;
    const plansWithoutMonthly = PLANS_CONSTANT.filter((p) => p.interval !== 'MONTHLY');
    const result = monthlySavings(plan, plansWithoutMonthly);
    expect(result).toBeNull();
  });

  it('does not produce fractional rupees', () => {
    const plan = PLANS_CONSTANT.find((p) => p.code === 'STANDARD_Q')!;
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).not.toBeNull();
    expect(result!.savedAmount).toEqual(Math.round(result!.savedAmount));
  });

  it('returns null if the plan interval is unrecognized', () => {
    const plan = { ...PLANS_CONSTANT[0], interval: 'UNKNOWN' as any };
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).toBeNull();
  });

  it('returns null if there is no actual savings (edge case)', () => {
    const plan = {
      ...PLANS_CONSTANT[0],
      interval: 'QUARTERLY' as const,
      amount: '1497.00', // 3 * 499 — no savings
    };
    const result = monthlySavings(plan, PLANS_CONSTANT);
    expect(result).toBeNull();
  });
});
