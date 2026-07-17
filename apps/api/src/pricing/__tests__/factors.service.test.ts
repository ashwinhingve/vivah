/**
 * Dynamic Pricing v1 — factor-resolution pure helpers.
 *
 * resolveFactors() itself hits Postgres; these tests cover its deterministic
 * building blocks. DB modules are mocked so importing the module never opens a
 * connection (mirrors vendors/__tests__/utilization.service.test.ts).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('drizzle-orm', () => {
  const stub = (..._args: unknown[]) => ({ _sql: true });
  return { eq: stub, and: stub, or: stub, inArray: stub, gte: stub, lte: stub, sql: stub };
});
vi.mock('@smartshaadi/db', () => ({
  calendarEvents: { kind: {}, eventDate: {}, endDate: {}, region: {}, name: {}, auspiciousBand: {} },
  bookings: { vendorId: {}, status: {}, eventDate: {} },
}));
vi.mock('../../lib/db.js', () => ({ db: { select: vi.fn() } }));

import {
  bandWeightFor,
  densityRatio,
  applyFactor,
  addDays,
  covers,
  inRegion,
} from '../factors.service.js';

describe('bandWeightFor', () => {
  it('maps each auspicious band to an ascending weight', () => {
    expect(bandWeightFor('NONE')).toBe(0);
    expect(bandWeightFor('LOW')).toBe(0.25);
    expect(bandWeightFor('MEDIUM')).toBe(0.5);
    expect(bandWeightFor('HIGH')).toBe(0.75);
    expect(bandWeightFor('PEAK')).toBe(1);
  });
  it('treats unknown bands as zero weight', () => {
    expect(bandWeightFor('WHATEVER')).toBe(0);
  });
});

describe('densityRatio', () => {
  it('is 0 for no active bookings', () => {
    expect(densityRatio(0)).toBe(0);
    expect(densityRatio(-3)).toBe(0);
  });
  it('scales linearly up to the reference then saturates at 1', () => {
    expect(densityRatio(5)).toBe(0.5); // 5 / 10
    expect(densityRatio(10)).toBe(1);
    expect(densityRatio(50)).toBe(1);
  });
});

describe('applyFactor', () => {
  it('returns 1 (no effect) at zero intensity', () => {
    expect(applyFactor(2.5, 0)).toBe(1);
  });
  it('returns the full multiplier at intensity 1', () => {
    expect(applyFactor(2.5, 1)).toBe(2.5);
  });
  it('interpolates a muhurat multiplier by band weight', () => {
    // muhuratMultiplier 1.4 at MEDIUM band (0.5) → 1 + 0.4×0.5 = 1.2
    expect(applyFactor(1.4, 0.5)).toBeCloseTo(1.2);
  });
  it('interpolates a discount below 1 the same way', () => {
    // offSeasonMultiplier 0.8 at intensity 0.5 → 1 + (−0.2)×0.5 = 0.9
    expect(applyFactor(0.8, 0.5)).toBeCloseTo(0.9);
  });
});

describe('addDays', () => {
  it('adds and subtracts whole UTC days across month boundaries', () => {
    expect(addDays('2026-07-17', 14)).toBe('2026-07-31');
    expect(addDays('2026-07-17', -14)).toBe('2026-07-03');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('covers', () => {
  it('matches a single-day event exactly', () => {
    expect(covers({ eventDate: '2026-11-01', endDate: null }, '2026-11-01')).toBe(true);
    expect(covers({ eventDate: '2026-11-01', endDate: null }, '2026-11-02')).toBe(false);
  });
  it('matches any day within an inclusive range', () => {
    const row = { eventDate: '2026-07-06', endDate: '2026-11-04' }; // Chaturmas-like
    expect(covers(row, '2026-07-06')).toBe(true);
    expect(covers(row, '2026-09-01')).toBe(true);
    expect(covers(row, '2026-11-04')).toBe(true);
    expect(covers(row, '2026-11-05')).toBe(false);
  });
});

describe('inRegion', () => {
  it('always includes national (null-region) rows', () => {
    expect(inRegion(null, 'Maharashtra')).toBe(true);
    expect(inRegion(null, undefined)).toBe(true);
  });
  it('includes a regional row only for the matching region', () => {
    expect(inRegion('Kerala', 'Kerala')).toBe(true);
    expect(inRegion('Kerala', 'Maharashtra')).toBe(false);
    expect(inRegion('Kerala', undefined)).toBe(false);
  });
});
