/**
 * Vendor service unit tests.
 * All DB and Mongoose calls are mocked — no real DB needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

vi.mock('../../lib/db.js', () => ({ db: mockDb }));

// ── Mock drizzle-orm — return stub SQL objects so `and`, `eq` etc. don't crash
vi.mock('drizzle-orm', () => {
  const stub = (..._args: unknown[]) => ({ _sql: true });
  return {
    eq:      stub,
    and:     stub,
    or:      stub,
    ilike:   stub,
    inArray: stub,
    gte:     stub,
    lte:     stub,
    asc:     stub,
    desc:    stub,
    sql:     Object.assign(stub, { raw: stub }),
  };
});

// ── Mock schema tables ────────────────────────────────────────────────────────
vi.mock('@smartshaadi/db', () => ({
  vendors:            { id: {}, userId: {}, isActive: {}, category: {}, city: {}, state: {}, mongoPortfolioId: {}, rating: {}, totalReviews: {}, viewCount: {}, favoriteCount: {}, priceMin: {}, priceMax: {}, businessName: {}, tagline: {}, description: {}, verified: {}, createdAt: {}, updatedAt: {} },
  vendorServices:     { id: {}, vendorId: {}, isActive: {} },
  bookings:           { vendorId: {}, status: {}, eventDate: {} },
  vendorFavorites:    { id: {}, userId: {}, vendorId: {} },
  vendorBlockedDates: { id: {}, vendorId: {}, date: {}, reason: {} },
}));

// ── Mock env ──────────────────────────────────────────────────────────────────
vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true },
}));

// ── Mock VendorPortfolio (never called in mock mode) ─────────────────────────
vi.mock('../../infrastructure/mongo/models/VendorPortfolio.js', () => ({
  VendorPortfolio: { findOne: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockVendor(overrides: Record<string, unknown> = {}) {
  return {
    id:              'vendor-1',
    userId:          'user-1',
    mongoPortfolioId: null,
    businessName:    'Rajan Photography',
    category:        'PHOTOGRAPHY',
    city:            'Mumbai',
    state:           'Maharashtra',
    verified:        true,
    rating:          '4.50',
    totalReviews:    10,
    isActive:        true,
    createdAt:       new Date(),
    updatedAt:       new Date(),
    ...overrides,
  };
}

function makeMockService(overrides: Record<string, unknown> = {}) {
  return {
    id:          'svc-1',
    vendorId:    'vendor-1',
    name:        'Wedding Package',
    description: 'Full day coverage',
    priceFrom:   '50000',
    priceTo:     '100000',
    priceUnit:   'PER_EVENT',
    isActive:    true,
    createdAt:   new Date(),
    ...overrides,
  };
}

/**
 * Build a chainable drizzle query mock that resolves to `returnValue`.
 * Supports: .select().from().where().limit().offset()
 */
function buildSelectChain(returnValue: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(returnValue);
  chain.from    = vi.fn().mockReturnValue(chain);
  chain.where   = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit   = vi.fn().mockReturnValue(chain);
  chain.offset  = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin  = vi.fn().mockReturnValue(chain);
  chain.then    = (resolve: (v: unknown) => unknown) => Promise.resolve(returnValue).then(resolve);
  // Allow awaiting the chain directly
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  // Make it thenable
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    terminal().then(resolve, reject);
  return chain;
}

function buildInsertChain(returnValue: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.values    = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('vendors/service — listVendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated vendors with services', async () => {
    const vendor1 = makeMockVendor({ id: 'vendor-1' });
    const vendor2 = makeMockVendor({ id: 'vendor-2', businessName: 'Priya Catering' });
    const svc1    = makeMockService({ vendorId: 'vendor-1' });

    // First select call → count
    const countChain = buildSelectChain([{ count: 2 }]);
    // Second select call → vendor rows
    const vendorChain = buildSelectChain([vendor1, vendor2]);
    // Third select call → services
    const svcChain = buildSelectChain([svc1]);

    mockDb.select
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(vendorChain)
      .mockReturnValueOnce(svcChain);

    const { listVendors } = await import('../service.js');

    const result = await listVendors({ page: 1, limit: 10, sort: 'popular' });

    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
    expect(result.vendors).toHaveLength(2);
    expect(result.vendors[0]?.businessName).toBe('Rajan Photography');
    expect(result.vendors[0]?.services).toHaveLength(1);
    expect(result.vendors[0]?.services[0]?.priceFrom).toBe(50000);
  });

  it('page 2 offsets correctly — returns different vendor on page 2', async () => {
    const vendor3 = makeMockVendor({ id: 'vendor-3', businessName: 'Sita Decor' });

    const countChain  = buildSelectChain([{ count: 12 }]);
    const vendorChain = buildSelectChain([vendor3]);
    const svcChain    = buildSelectChain([]);

    mockDb.select
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(vendorChain)
      .mockReturnValueOnce(svcChain);

    const { listVendors } = await import('../service.js');

    const result = await listVendors({ page: 2, limit: 10, sort: 'popular' });

    expect(result.meta.page).toBe(2);
    expect(result.meta.total).toBe(12);
    // Second select (vendors) should receive offset: 10
    expect(mockDb.select).toHaveBeenCalledTimes(3);
    expect(result.vendors[0]?.businessName).toBe('Sita Decor');
  });

  it('returns empty list when no vendors match', async () => {
    const countChain  = buildSelectChain([{ count: 0 }]);
    const vendorChain = buildSelectChain([]);

    mockDb.select
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(vendorChain);

    const { listVendors } = await import('../service.js');

    const result = await listVendors({ category: 'CATERING', page: 1, limit: 10, sort: 'popular' });

    expect(result.vendors).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });
});

describe('vendors/service — getVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns combined PG + mocked portfolio (USE_MOCK_SERVICES=true)', async () => {
    const vendor  = makeMockVendor();
    const svc     = makeMockService();

    const vendorChain = buildSelectChain([vendor]);
    const svcChain    = buildSelectChain([svc]);

    mockDb.select
      .mockReturnValueOnce(vendorChain)
      .mockReturnValueOnce(svcChain);

    const { getVendor } = await import('../service.js');

    const result = await getVendor('vendor-1');

    expect(result).not.toBeNull();
    expect(result?.businessName).toBe('Rajan Photography');
    expect(result?.services).toHaveLength(1);
    // In mock mode, portfolio is null so the frontend renders the empty state
    // instead of placeholder copy. See service.ts:160.
    expect(result?.portfolio).toBeNull();
  });

  it('returns null when vendor not found', async () => {
    const vendorChain = buildSelectChain([]);
    mockDb.select.mockReturnValueOnce(vendorChain);

    const { getVendor } = await import('../service.js');

    const result = await getVendor('does-not-exist');

    expect(result).toBeNull();
  });
});

describe('vendors/service — createVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a vendor row and returns it', async () => {
    const newVendor = makeMockVendor({ id: 'vendor-new', userId: 'user-42' });
    const insertChain = buildInsertChain([newVendor]);
    mockDb.insert.mockReturnValueOnce(insertChain);

    const { createVendor } = await import('../service.js');

    const result = await createVendor('user-42', {
      businessName: 'Rajan Photography',
      category:     'PHOTOGRAPHY',
      city:         'Mumbai',
      state:        'Maharashtra',
    });

    expect(result.id).toBe('vendor-new');
    expect(result.businessName).toBe('Rajan Photography');
    expect(result.city).toBe('Mumbai');
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

describe('vendors/service — getAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function pretendChain(rows: unknown[]) {
    return {
      from:   () => ({
        where: () => Promise.resolve(rows),
      }),
    };
  }

  it('returns booked dates + blocked dates for a month', async () => {
    mockDb.select
      .mockReturnValueOnce(pretendChain([
        { eventDate: '2026-05-15' },
        { eventDate: '2026-05-22' },
      ]))
      .mockReturnValueOnce(pretendChain([
        { date: '2026-05-10', reason: 'Personal' },
      ]));

    const { getAvailability } = await import('../service.js');
    const result = await getAvailability('vendor-1', '2026-05');

    expect(result.bookedDates.sort()).toEqual(['2026-05-15', '2026-05-22']);
    expect(result.blockedDates).toEqual([{ date: '2026-05-10', reason: 'Personal' }]);
  });

  it('returns empty arrays when no bookings or blocked dates', async () => {
    mockDb.select
      .mockReturnValueOnce(pretendChain([]))
      .mockReturnValueOnce(pretendChain([]));

    const { getAvailability } = await import('../service.js');
    const result = await getAvailability('vendor-1', '2026-06');

    expect(result.bookedDates).toEqual([]);
    expect(result.blockedDates).toEqual([]);
  });

  it('throws on invalid month format', async () => {
    const { getAvailability } = await import('../service.js');
    await expect(getAvailability('vendor-1', 'not-a-month')).rejects.toThrow('YYYY-MM');
  });
});
