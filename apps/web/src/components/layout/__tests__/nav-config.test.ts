import { describe, it, expect } from 'vitest';
import { navForRole, splitPrimary } from '../nav-config';

describe('splitPrimary', () => {
  it('returns primary unchanged with empty overflow when no mobile set exists', () => {
    const { primary, primaryMobile } = navForRole('INDIVIDUAL');
    const { mobile, overflow } = splitPrimary(primary, primaryMobile);
    expect(mobile).toEqual(primary);
    expect(overflow).toEqual([]);
  });

  it('VENDOR mobile set is capped at 4 with the rest as overflow', () => {
    const { primary, primaryMobile } = navForRole('VENDOR');
    const { mobile, overflow } = splitPrimary(primary, primaryMobile);
    expect(mobile.map((i) => i.href)).toEqual([
      '/vendor-dashboard',
      '/bookings',
      '/vendor-dashboard/orders',
      '/profile/personal',
    ]);
    expect(overflow.map((i) => i.href)).toEqual([
      '/vendor-dashboard/store',
      '/vendor/payouts',
      '/payments/links',
    ]);
  });

  it('every overflow item still exists in desktop primary (nothing lost)', () => {
    const { primary, primaryMobile } = navForRole('VENDOR');
    const { overflow } = splitPrimary(primary, primaryMobile);
    const primaryHrefs = new Set(primary.map((i) => i.href));
    for (const item of overflow) expect(primaryHrefs.has(item.href)).toBe(true);
  });
});
