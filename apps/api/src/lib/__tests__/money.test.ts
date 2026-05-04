import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees } from '../money.js';

describe('rupeesToPaise', () => {
  it('converts whole rupees to paise', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(500)).toBe(50000);
    expect(rupeesToPaise(1)).toBe(100);
  });

  it('rounds floating-point sums to nearest paise', () => {
    expect(rupeesToPaise(99.99)).toBe(9999);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(0.005)).toBe(1);
    expect(rupeesToPaise(99.99 * 3)).toBe(29997);
  });

  it('handles zero', () => {
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('rejects negative input', () => {
    expect(() => rupeesToPaise(-1)).toThrow(/negative/);
  });

  it('rejects non-finite input', () => {
    expect(() => rupeesToPaise(NaN)).toThrow(/non-finite/);
    expect(() => rupeesToPaise(Infinity)).toThrow(/non-finite/);
  });
});

describe('paiseToRupees', () => {
  it('converts paise back to rupees', () => {
    expect(paiseToRupees(10000)).toBe(100);
    expect(paiseToRupees(1)).toBe(0.01);
    expect(paiseToRupees(0)).toBe(0);
  });
});
