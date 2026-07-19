/**
 * Premium package service — the placeholder commercial guard.
 *
 * This file exists because of the process note in Sprint G: a suite that only
 * asserts the FAILURE path cannot tell "the guard works" from "the guard is
 * missing and something else happens to error". Every case here that proves a
 * refusal is paired with one proving the same call SUCCEEDS once the flag is
 * cleared, so a deleted guard turns the suite red rather than leaving it green.
 *
 * Covers:
 *   - assertBookable REFUSES placeholder supply with PLACEHOLDER_SUPPLY
 *   - assertBookable ALLOWS the identical row once is_placeholder is false
 *   - inactive supply is refused regardless of the flag, with a DIFFERENT code
 *   - a missing package is NOT_FOUND, not a placeholder refusal
 *   - the browse query never filters on is_placeholder (visibility is unaffected)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbState, makeChain, capturedWhere } = vi.hoisted(() => {
  const dbState = { queue: [] as unknown[][] };
  const capturedWhere: unknown[] = [];

  const makeChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = {};
    const ret = () => p;
    for (const m of [
      'from', 'groupBy', 'orderBy', 'innerJoin', 'leftJoin', 'rightJoin',
      'limit', 'offset', 'having', 'set', 'returning', 'values',
      'onConflictDoNothing', 'selectDistinct',
    ]) {
      p[m] = ret;
    }
    // Record the predicate so a test can assert what was NOT filtered on.
    p.where = (cond: unknown) => { capturedWhere.push(cond); return p; };
    p.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve(dbState.queue.shift() ?? []));
    return p;
  };

  return { dbState, makeChain, capturedWhere };
});

vi.mock('../../lib/db.js', () => ({
  db: {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    transaction: async (fn: (tx: unknown) => unknown) => fn({
      insert: () => makeChain(),
      update: () => makeChain(),
      delete: () => makeChain(),
      select: () => makeChain(),
    }),
  },
}));

// Static import, not `await import`: vi.mock is hoisted above imports, so the
// db mock is already installed by the time this binds — and a top-level await
// fails tsc under this package's CommonJS module setting (TS1309), even though
// Vitest's ESM loader accepts it.
import { assertBookable, listPackages, PackageError } from '../service.js';

/**
 * Collect every database column name referenced anywhere in a Drizzle
 * condition tree.
 *
 * Cycle-safe by construction: a Drizzle column carries a back reference to its
 * table, so the graph contains loops and a naive traversal (or JSON.stringify)
 * never terminates.
 */
function collectColumnNames(root: unknown): string[] {
  const seen = new WeakSet<object>();
  const names: string[] = [];

  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    // A Drizzle column exposes both `name` (the SQL identifier) and `columnType`.
    const maybe = node as { name?: unknown; columnType?: unknown };
    if (typeof maybe.name === 'string' && typeof maybe.columnType === 'string') {
      names.push(maybe.name);
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      // Do NOT follow a column's back reference to its table. That edge leads
      // to every column the table declares, so traversing it would report
      // `is_placeholder` as "referenced" even when the predicate never mentions
      // it — the assertion would then be impossible to fail.
      if (key === 'table') continue;
      walk(value);
    }
  };

  walk(root);
  return names;
}

/** A complete premium_packages row, real (not placeholder) by default. */
function packageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    vendorId: '22222222-2222-4222-8222-222222222222',
    slug: 'test-package',
    title: 'Test Package',
    tier: 'SIGNATURE',
    destinationCity: 'Udaipur',
    cityId: null,
    countryCode: 'IN',
    priceFrom: '850000.00',
    currency: 'INR',
    guestCapacityMin: 50,
    guestCapacityMax: 200,
    durationNights: 2,
    summary: null,
    description: null,
    heroImageUrl: null,
    isPlaceholder: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  dbState.queue = [];
  capturedWhere.length = 0;
});

describe('assertBookable — the placeholder commercial guard', () => {
  it('REFUSES a placeholder package with PLACEHOLDER_SUPPLY', async () => {
    dbState.queue = [[packageRow({ isPlaceholder: true })]];

    await expect(assertBookable('11111111-1111-4111-8111-111111111111'))
      .rejects.toMatchObject({ code: 'PLACEHOLDER_SUPPLY' });
  });

  it('ALLOWS the identical row once is_placeholder is false', async () => {
    // Same row, one field flipped. If the guard were deleted, the test above
    // would fail and this one would still pass — which is exactly why both
    // directions are asserted.
    dbState.queue = [[packageRow({ isPlaceholder: false })]];

    const pkg = await assertBookable('11111111-1111-4111-8111-111111111111');
    expect(pkg.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(pkg.isPlaceholder).toBe(false);
  });

  it('refuses INACTIVE supply with a different code, not PLACEHOLDER_SUPPLY', async () => {
    // Distinguishing these matters: "retired" and "not yet real" are different
    // states and the UI says different things about them.
    dbState.queue = [[packageRow({ isActive: false, isPlaceholder: false })]];

    await expect(assertBookable('11111111-1111-4111-8111-111111111111'))
      .rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('reports NOT_FOUND for a missing package rather than a placeholder refusal', async () => {
    dbState.queue = [[]];

    await expect(assertBookable('99999999-9999-4999-8999-999999999999'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws a typed PackageError, not a generic Error', async () => {
    dbState.queue = [[packageRow({ isPlaceholder: true })]];

    await expect(assertBookable('11111111-1111-4111-8111-111111111111'))
      .rejects.toBeInstanceOf(PackageError);
  });

  it('returns the package on success so callers need not re-query', async () => {
    dbState.queue = [[packageRow({ priceFrom: '1234567.89' })]];

    const pkg = await assertBookable('11111111-1111-4111-8111-111111111111');
    // Money stays a STRING end to end — parsing it would round large amounts.
    expect(pkg.priceFrom).toBe('1234567.89');
    expect(typeof pkg.priceFrom).toBe('string');
  });
});

describe('browse visibility is NOT affected by is_placeholder', () => {
  it('returns placeholder rows from listPackages exactly like real ones', async () => {
    dbState.queue = [
      [{
        pkg: packageRow({ isPlaceholder: true }),
        vendorName: 'Amrit Haveli Retreat',
        vendorCity: 'Udaipur',
        vendorVerified: true,
        vendorRating: '4.80',
      }],
      [{ total: 1 }],
    ];

    const result = await listPackages({
      sort: 'DEFAULT', page: 1, limit: 12,
    } as Parameters<typeof listPackages>[0]);

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.isPlaceholder).toBe(true);
    expect(result.total).toBe(1);
  });

  it('never mentions is_placeholder in the browse predicate', async () => {
    dbState.queue = [[], [{ total: 0 }]];

    await listPackages({
      sort: 'DEFAULT', page: 1, limit: 12,
    } as Parameters<typeof listPackages>[0]);

    // Walking the captured Drizzle condition for referenced column names
    // catches a future "just filter them out" change directly, rather than
    // relying on a row-count assertion a filter could still satisfy.
    //
    // A plain JSON.stringify cannot be used: a Drizzle column holds a back
    // reference to its table, so the structure is circular.
    const columns = collectColumnNames(capturedWhere);
    expect(columns).toContain('is_active');       // the filter we DO expect
    expect(columns).not.toContain('is_placeholder');
  });
});
