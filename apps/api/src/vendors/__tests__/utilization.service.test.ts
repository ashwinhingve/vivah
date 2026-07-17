/**
 * Vendor Utilization Engine — Service tests
 *
 * Tests the pure, deterministic ranking function + DB query integration.
 * DB calls are mocked — focuses on ranking logic and money conversion.
 */

import { describe, it, expect, vi } from 'vitest';
import { rupeesToPaise, paiseToRupees } from '../../lib/money.js';
import { asProfileId } from '@smartshaadi/types';
import type { VendorCapacityWindow } from '@smartshaadi/types';

// ── Mock drizzle-orm ──────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => {
  const stub = (..._args: unknown[]) => ({ _sql: true });
  return {
    eq:      stub,
    and:     stub,
    or:      stub,
    inArray: stub,
    gte:     stub,
    lte:     stub,
  };
});

// ── Mock schema tables ────────────────────────────────────────────────────────
vi.mock('@smartshaadi/db', () => ({
  vendorCapacity:   { id: {}, profileId: {}, status: {}, offSeason: {}, startAt: {}, endAt: {} },
  vendorEventTypes: { id: {}, vendorId: {}, eventType: {}, available: {} },
  vendors:          { id: {} },
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import the functions after mocking
import {
  rankUtilizationWindows,
  computeExpectedMarginPaise,
  computeUtilizationScore,
  type RankedWindow,
} from '../utilization.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWindow(overrides: Partial<VendorCapacityWindow> = {}): VendorCapacityWindow {
  return {
    id:          overrides.id ?? 'window-1',
    profileId:   overrides.profileId ?? asProfileId('vendor-1'),
    startAt:     overrides.startAt ?? '2026-07-20T10:00:00Z',
    endAt:       overrides.endAt ?? '2026-07-20T18:00:00Z',
    status:      'OPEN',
    maxBookings: overrides.maxBookings ?? 3,
    bookedCount: overrides.bookedCount ?? 0,
    offSeason:   overrides.offSeason ?? true,
    notes:       overrides.notes ?? null,
    createdAt:   '2026-07-17T10:00:00Z',
    updatedAt:   '2026-07-17T10:00:00Z',
  };
}

function makeRanked(window: VendorCapacityWindow, booked: number = 0): RankedWindow {
  return {
    window,
    remainingCapacity: window.maxBookings - booked,
    eventTypeMatch: 'CORPORATE',
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('rankUtilizationWindows', () => {
  it('returns empty array for empty input', () => {
    const result = rankUtilizationWindows([]);
    expect(result).toEqual([]);
  });

  it('ranks by start date ascending (earlier first)', () => {
    const win1 = makeRanked(makeWindow({ id: 'a', startAt: '2026-07-25T10:00:00Z' }));
    const win2 = makeRanked(makeWindow({ id: 'b', startAt: '2026-07-20T10:00:00Z' }));
    const win3 = makeRanked(makeWindow({ id: 'c', startAt: '2026-07-22T10:00:00Z' }));

    const result = rankUtilizationWindows([win1, win2, win3]);

    expect(result[0]!.window.id).toBe('b');
    expect(result[1]!.window.id).toBe('c');
    expect(result[2]!.window.id).toBe('a');
  });

  it('tie-breaks by remaining capacity descending (higher first)', () => {
    const win1 = makeRanked(makeWindow({ id: 'a' }), 0); // 3 remaining
    const win2 = makeRanked(makeWindow({ id: 'b' }), 2); // 1 remaining
    const win3 = makeRanked(makeWindow({ id: 'c' }), 1); // 2 remaining
    // All same date

    const result = rankUtilizationWindows([win1, win2, win3]);

    expect(result[0]!.window.id).toBe('a'); // 3 remaining
    expect(result[1]!.window.id).toBe('c'); // 2 remaining
    expect(result[2]!.window.id).toBe('b'); // 1 remaining
  });

  it('tie-breaks by id lexicographic when date + capacity tie', () => {
    const win1 = makeRanked(makeWindow({ id: 'z' }), 1); // same date, same capacity
    const win2 = makeRanked(makeWindow({ id: 'a' }), 1);
    const win3 = makeRanked(makeWindow({ id: 'm' }), 1);

    const result = rankUtilizationWindows([win1, win2, win3]);

    expect(result[0]!.window.id).toBe('a');
    expect(result[1]!.window.id).toBe('m');
    expect(result[2]!.window.id).toBe('z');
  });

  it('full ranking: date → capacity → id', () => {
    // Date 2026-07-20, capacity 3, id 'a'
    const win1 = makeRanked(makeWindow({ id: 'a', startAt: '2026-07-20T10:00:00Z' }), 0);
    // Date 2026-07-20, capacity 2, id 'b'
    const win2 = makeRanked(makeWindow({ id: 'b', startAt: '2026-07-20T10:00:00Z' }), 1);
    // Date 2026-07-20, capacity 2, id 'z' (same capacity as win2, but higher id)
    const win3 = makeRanked(makeWindow({ id: 'z', startAt: '2026-07-20T10:00:00Z' }), 1);
    // Date 2026-07-25, capacity 3, id 'c'
    const win4 = makeRanked(makeWindow({ id: 'c', startAt: '2026-07-25T10:00:00Z' }), 0);

    const result = rankUtilizationWindows([win4, win3, win1, win2]);

    // Order: win1 (earliest, highest capacity)
    //        win2 (earliest, tied capacity, lower id)
    //        win3 (earliest, tied capacity, higher id)
    //        win4 (later date)
    expect(result.map((w) => w.window.id)).toEqual(['a', 'b', 'z', 'c']);
  });

  it('preserves window data through ranking', () => {
    const original = makeRanked(
      makeWindow({
        id: 'test',
        notes: 'test note',
        offSeason: true,
      }),
    );

    const result = rankUtilizationWindows([original]);

    expect(result[0]!.window.id).toBe('test');
    expect(result[0]!.window.notes).toBe('test note');
    expect(result[0]!.window.offSeason).toBe(true);
    expect(result[0]!.remainingCapacity).toBe(3);
    expect(result[0]!.eventTypeMatch).toBe('CORPORATE');
  });

  it('handles single window', () => {
    const win = makeRanked(makeWindow());
    const result = rankUtilizationWindows([win]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(win);
  });
});

describe('computeExpectedMarginPaise', () => {
  it('converts rupees to paise correctly', () => {
    const result = computeExpectedMarginPaise(100);
    expect(result).toBe(BigInt(10000)); // 100 * 100 paise
  });

  it('handles 0 rupees', () => {
    const result = computeExpectedMarginPaise(0);
    expect(result).toBe(BigInt(0));
  });

  it('handles fractional rupees (rounded)', () => {
    const result = computeExpectedMarginPaise(99.99);
    expect(Number(result)).toBe(9999); // rounded
  });

  it('returns BigInt for large amounts', () => {
    const result = computeExpectedMarginPaise(50000);
    expect(typeof result).toBe('bigint');
    expect(result).toBe(BigInt(5000000));
  });

  it('throws on negative input', () => {
    expect(() => computeExpectedMarginPaise(-100)).toThrow();
  });

  it('throws on non-finite input', () => {
    expect(() => computeExpectedMarginPaise(NaN)).toThrow();
    expect(() => computeExpectedMarginPaise(Infinity)).toThrow();
  });
});

describe('computeUtilizationScore', () => {
  const referenceDate = new Date('2026-07-17T10:00:00Z');

  it('scores window starting today with full capacity', () => {
    const win = makeRanked(
      makeWindow({
        id: 'today',
        startAt: '2026-07-17T10:00:00Z', // same as reference
        maxBookings: 1,
      }),
      0, // 1 remaining
    );
    const score = computeUtilizationScore(win, referenceDate);
    // remaining ratio = 1/1 = 1.0 (0.5 points)
    // recency = 1 - 0/60 = 1.0 (0.5 points)
    // total = 0.5 + 0.5 = 1.0
    expect(score).toBe(1.0);
  });

  it('scores window with half capacity', () => {
    const win = makeRanked(
      makeWindow({
        id: 'half',
        startAt: '2026-07-17T10:00:00Z',
        maxBookings: 2,
      }),
      1, // 1 remaining out of 2
    );
    const score = computeUtilizationScore(win, referenceDate);
    // remaining ratio = 1/2 = 0.5 (0.25 points)
    // recency = 1.0 (0.5 points)
    // total = 0.75
    expect(score).toBe(0.75);
  });

  it('scores window 30 days in future', () => {
    const win = makeRanked(
      makeWindow({
        id: 'future',
        startAt: '2026-08-16T10:00:00Z', // 30 days later
        maxBookings: 1,
      }),
      0,
    );
    const score = computeUtilizationScore(win, referenceDate);
    // remaining ratio = 1.0 (0.5 points)
    // recency = 1 - 30/60 = 0.5 (0.25 points)
    // total = 0.75
    expect(score).toBeCloseTo(0.75, 2);
  });

  it('scores window 60+ days in future as low recency', () => {
    const win = makeRanked(
      makeWindow({
        id: 'distant',
        startAt: '2026-09-16T10:00:00Z', // 61 days later
        maxBookings: 1,
      }),
      0,
    );
    const score = computeUtilizationScore(win, referenceDate);
    // recency capped at 0 for >60d
    // remaining ratio = 1.0 (0.5 points)
    // recency = 0 (0 points)
    // total = 0.5
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it('scores fully booked window low', () => {
    const win = makeRanked(
      makeWindow({
        id: 'full',
        startAt: '2026-07-17T10:00:00Z',
        maxBookings: 3,
      }),
      3, // 0 remaining
    );
    const score = computeUtilizationScore(win, referenceDate);
    // remaining ratio = 0/3 = 0 (0 points)
    // recency = 1.0 (0.5 points)
    // total = 0.5
    expect(score).toBe(0.5);
  });

  it('scores past window with clamped recency', () => {
    // Window started in the past — recency should clamp to 0
    const win = makeRanked(
      makeWindow({
        id: 'past',
        startAt: '2026-07-10T10:00:00Z', // 7 days ago
        maxBookings: 1,
      }),
      0,
    );
    const score = computeUtilizationScore(win, referenceDate);
    // remaining ratio = 1.0 (0.5 points)
    // recency = 1 - (-7/60) clamped to 0 (0 points)
    // total = 0.5
    expect(score).toBeLessThanOrEqual(0.5);
  });
});

describe('Money conversion edge cases', () => {
  it('round-trip rupees ↔ paise', () => {
    const original = 12345.67;
    const paise = rupeesToPaise(original);
    const back = paiseToRupees(paise);
    expect(back).toBeCloseTo(original, 2);
  });

  it('handles expected margin margin correctly', () => {
    const leadFeeInr = 250;
    const marginPaise = computeExpectedMarginPaise(leadFeeInr);
    const marginRupees = paiseToRupees(Number(marginPaise));
    expect(marginRupees).toBe(250);
  });
});
