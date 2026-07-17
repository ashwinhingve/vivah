/**
 * Vendor Gap Detection — pure computeSupplyGaps() tests.
 *
 * queryVendorSupply() hits Postgres; the pure combiner is what carries the logic.
 * DB modules are mocked so importing the module opens no connection (mirrors
 * utilization.service.test.ts).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('drizzle-orm', () => {
  const stub = (..._args: unknown[]) => ({ _sql: true });
  return { eq: stub, and: stub, sql: stub };
});
vi.mock('@smartshaadi/db', () => ({
  vendors: { city: {}, category: {}, isActive: {}, status: {} },
}));
vi.mock('../../lib/db.js', () => ({ db: { select: vi.fn() } }));

import {
  computeSupplyGaps,
  EXPECTED_CATEGORIES,
  DEFAULT_GAP_THRESHOLD,
  type SupplyRow,
} from '../gap.service.js';

// Small, explicit category set keeps assertions readable.
const CATS = ['PHOTOGRAPHY', 'CATERING', 'VENUE'];

describe('EXPECTED_CATEGORIES', () => {
  it('excludes the OTHER residual bucket', () => {
    expect(EXPECTED_CATEGORIES).not.toContain('OTHER');
    expect(EXPECTED_CATEGORIES).toContain('PHOTOGRAPHY');
  });
});

describe('computeSupplyGaps', () => {
  it('returns no gaps when every cell meets the threshold', () => {
    const supply: SupplyRow[] = [
      { city: 'Pune', category: 'PHOTOGRAPHY', supply: 5 },
      { city: 'Pune', category: 'CATERING', supply: 4 },
      { city: 'Pune', category: 'VENUE', supply: 3 },
    ];
    const report = computeSupplyGaps({ supply, categories: CATS, threshold: 3 });
    expect(report.gaps).toHaveLength(0);
    expect(report.underSuppliedCount).toBe(0);
    expect(report.cellsEvaluated).toBe(3); // 1 city × 3 categories
    expect(report.citiesEvaluated).toBe(1);
  });

  it('does NOT flag a cell exactly at the threshold, but flags one below', () => {
    const supply: SupplyRow[] = [
      { city: 'Pune', category: 'PHOTOGRAPHY', supply: 3 }, // == threshold → ok
      { city: 'Pune', category: 'CATERING', supply: 2 }, // < threshold → gap
      { city: 'Pune', category: 'VENUE', supply: 3 },
    ];
    const report = computeSupplyGaps({ supply, categories: CATS, threshold: 3 });
    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0]).toMatchObject({
      city: 'Pune',
      category: 'CATERING',
      supply: 2,
      threshold: 3,
      shortfall: 1,
    });
  });

  it('treats an absent (city × category) cell as zero supply', () => {
    // Pune has photographers but NO caterers or venues at all.
    const supply: SupplyRow[] = [{ city: 'Pune', category: 'PHOTOGRAPHY', supply: 9 }];
    const report = computeSupplyGaps({ supply, categories: CATS, threshold: 2 });
    expect(report.gaps).toHaveLength(2);
    for (const g of report.gaps) expect(g.supply).toBe(0);
    expect(report.gaps.map((g) => g.category).sort()).toEqual(['CATERING', 'VENUE']);
  });

  it('sorts by shortfall desc, then city asc, then category asc', () => {
    const supply: SupplyRow[] = [
      { city: 'Delhi', category: 'PHOTOGRAPHY', supply: 4 }, // ok
      { city: 'Delhi', category: 'CATERING', supply: 1 }, // shortfall 4
      { city: 'Delhi', category: 'VENUE', supply: 3 }, // shortfall 2
      { city: 'Agra', category: 'CATERING', supply: 3 }, // shortfall 2
    ];
    const report = computeSupplyGaps({ supply, categories: CATS, threshold: 5 });
    const order = report.gaps.map((g) => `${g.city}/${g.category}(${g.shortfall})`);
    // Delhi/CATERING has the largest shortfall (4). Then the two shortfall-2 cells,
    // tie-broken city asc (Agra before Delhi). Agra's PHOTOGRAPHY/VENUE are 0 supply
    // → shortfall 5, so they lead. Verify full deterministic order:
    expect(order[0]).toBe('Agra/PHOTOGRAPHY(5)');
    expect(order[1]).toBe('Agra/VENUE(5)');
    expect(order[2]).toBe('Delhi/CATERING(4)');
    // shortfall-2 tie: Agra/CATERING before Delhi/VENUE
    expect(order.indexOf('Agra/CATERING(2)')).toBeLessThan(order.indexOf('Delhi/VENUE(2)'));
  });

  it('reports empty supply as zero cities and zero gaps', () => {
    const report = computeSupplyGaps({ supply: [], categories: CATS, threshold: 3 });
    expect(report.gaps).toHaveLength(0);
    expect(report.citiesEvaluated).toBe(0);
    expect(report.cellsEvaluated).toBe(0);
  });

  it('carries the threshold through to the report and each cell', () => {
    const supply: SupplyRow[] = [{ city: 'Pune', category: 'PHOTOGRAPHY', supply: 0 }];
    const report = computeSupplyGaps({ supply, categories: ['PHOTOGRAPHY'], threshold: 7 });
    expect(report.threshold).toBe(7);
    expect(report.gaps[0]?.threshold).toBe(7);
    expect(report.gaps[0]?.shortfall).toBe(7);
  });

  it('exposes a sane default threshold', () => {
    expect(DEFAULT_GAP_THRESHOLD).toBeGreaterThan(0);
  });
});
