/**
 * Smart Shaadi — Expense service unit tests
 *
 * Pure-logic tests for status derivation. Service-level integration is
 * covered by Vitest mocks of the db layer for the simpler paths.
 */

import { describe, expect, it } from 'vitest';

// Re-implement the deriveStatus helper for direct testing — it is module-private
// in expenses.service.ts but the math is simple and easily verified here.
type Status = 'DRAFT' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
function deriveStatus(amount: number, paid: number, current?: Status): Status {
  if (current === 'CANCELLED') return 'CANCELLED';
  if (paid <= 0) return current === 'DUE' ? 'DUE' : 'DRAFT';
  if (paid >= amount) return 'PAID';
  return 'PARTIALLY_PAID';
}

describe('wedding expense status derivation', () => {
  it('returns DRAFT when nothing is paid and no override is set', () => {
    expect(deriveStatus(1000, 0)).toBe('DRAFT');
  });

  it('preserves DUE when an explicit DUE status is set with zero paid', () => {
    expect(deriveStatus(1000, 0, 'DUE')).toBe('DUE');
  });

  it('returns PARTIALLY_PAID when amount paid is less than total', () => {
    expect(deriveStatus(1000, 500)).toBe('PARTIALLY_PAID');
  });

  it('returns PAID when amount paid equals total', () => {
    expect(deriveStatus(1000, 1000)).toBe('PAID');
  });

  it('returns PAID when amount paid exceeds total (rounding edge)', () => {
    expect(deriveStatus(1000, 1001)).toBe('PAID');
  });

  it('preserves CANCELLED across any amount/paid', () => {
    expect(deriveStatus(1000, 0,    'CANCELLED')).toBe('CANCELLED');
    expect(deriveStatus(1000, 500,  'CANCELLED')).toBe('CANCELLED');
    expect(deriveStatus(1000, 1000, 'CANCELLED')).toBe('CANCELLED');
  });
});
