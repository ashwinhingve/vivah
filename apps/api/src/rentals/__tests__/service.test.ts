/**
 * Rental service unit tests.
 * All DB calls are mocked — no real I/O.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock('@smartshaadi/db', () => ({
  rentalItems:    {},
  rentalBookings: {},
  vendors:        {},
}));

vi.mock('drizzle-orm', () => ({
  eq:      vi.fn((_c: unknown, _v: unknown) => ({ type: 'eq', _c, _v })),
  and:     vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((_c: unknown, _v: unknown) => ({ type: 'inArray', _c, _v })),
  lte:     vi.fn((_c: unknown, _v: unknown) => ({ type: 'lte', _c, _v })),
  gte:     vi.fn((_c: unknown, _v: unknown) => ({ type: 'gte', _c, _v })),
  sql:     vi.fn((..._args: unknown[]) => ({ type: 'sql' })),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, REDIS_URL: 'redis://localhost:6379' },
}));

// ── Chain builders ────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeSelectChainResolvable(rows: Row[]) {
  // Supports any chain order: .from().where().limit().offset() or .innerJoin().where().limit()
  // Each method returns the same chain object; terminal async methods resolve to `rows`.
  const offsetChain = {
    then:    (onfulfilled: (v: Row[]) => unknown) => Promise.resolve(rows).then(onfulfilled),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  const limitChain = {
    offset: vi.fn().mockReturnValue(offsetChain),
    then:   (onfulfilled: (v: Row[]) => unknown) => Promise.resolve(rows).then(onfulfilled),
  };
  const chain: Record<string, unknown> = {
    from:      vi.fn(),
    where:     vi.fn(),
    limit:     vi.fn().mockReturnValue(limitChain),
    orderBy:   vi.fn().mockResolvedValue(rows),
    innerJoin: vi.fn(),
    groupBy:   vi.fn().mockResolvedValue(rows),
    then:      (onfulfilled: (v: Row[]) => unknown) => Promise.resolve(rows).then(onfulfilled),
  };
  // All chainable methods return the chain itself
  (chain['from'] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['where'] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['innerJoin'] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}


function makeInsertChain(rows: Row[]) {
  return {
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
}

function makeUpdateChain(rows: Row[]) {
  return {
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID    = 'user-text-id-1';
const VENDOR_ID  = 'vendor-uuid-1';
const ITEM_ID    = 'item-uuid-1';
const BOOKING_ID = 'booking-uuid-1';

const vendorRow = { id: VENDOR_ID, userId: USER_ID };

const itemRow = {
  id:          ITEM_ID,
  vendorId:    VENDOR_ID,
  name:        'Golden Arch Decor',
  description: 'Beautiful arch for ceremonies',
  category:    'DECOR',
  pricePerDay: '500.00',
  deposit:     '200.00',
  stockQty:    5,
  r2ImageKeys: [],
  isActive:    true,
  createdAt:   new Date(),
};

const bookingRow = {
  id:           BOOKING_ID,
  rentalItemId: ITEM_ID,
  customerId:   USER_ID,
  fromDate:     '2026-05-01',
  toDate:       '2026-05-04',
  quantity:     2,
  totalAmount:  '3000.00',
  depositPaid:  '400.00',
  status:       'PENDING',
  notes:        null,
  createdAt:    new Date(),
  updatedAt:    new Date(),
};

// ── Service imports (after mocks) ─────────────────────────────────────────────

import {
  listRentalItems,
  createRentalItem,
  createRentalBooking,
  confirmRentalBooking,
  returnRentalItem,
  getMyRentalBookings,
} from '../service.js';

// ── listRentalItems ───────────────────────────────────────────────────────────

describe('listRentalItems', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('applies category filter and returns paginated shape', async () => {
    // count query
    mockSelect
      .mockReturnValueOnce(makeSelectChainResolvable([{ count: 1 }]))
      // items query
      .mockReturnValueOnce(makeSelectChainResolvable([itemRow]));

    const result = await listRentalItems({ category: 'DECOR', page: 1, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.category).toBe('DECOR');
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.total).toBe(1);
  });

  it('returns paginated meta shape even with no results', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChainResolvable([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChainResolvable([]));

    const result = await listRentalItems({ page: 2, limit: 5 });
    expect(result.items).toHaveLength(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.page).toBe(2);
  });

  it('date-range availability filter excludes fully-booked item', async () => {
    // stockQty = 2, reserved = 2 → excluded
    const fullyBookedItem = { ...itemRow, stockQty: 2 };

    mockSelect
      .mockReturnValueOnce(makeSelectChainResolvable([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChainResolvable([fullyBookedItem]))
      // overlapping bookings aggregate: reserved = 2 (equal to stock)
      .mockReturnValueOnce(makeSelectChainResolvable([{ rentalItemId: ITEM_ID, reserved: 2 }]));

    const result = await listRentalItems({
      page:     1,
      limit:    10,
      fromDate: '2026-05-01',
      toDate:   '2026-05-04',
    });

    expect(result.items).toHaveLength(0); // fully booked, excluded
  });

  it('date-range filter keeps item with partial bookings', async () => {
    // stockQty = 5, reserved = 2 → still available (5 - 2 = 3 free)
    mockSelect
      .mockReturnValueOnce(makeSelectChainResolvable([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChainResolvable([itemRow]))
      .mockReturnValueOnce(makeSelectChainResolvable([{ rentalItemId: ITEM_ID, reserved: 2 }]));

    const result = await listRentalItems({
      page:     1,
      limit:    10,
      fromDate: '2026-05-01',
      toDate:   '2026-05-04',
    });

    expect(result.items).toHaveLength(1);
  });
});

// ── createRentalItem ──────────────────────────────────────────────────────────

describe('createRentalItem', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates item after resolving vendor from userId', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([vendorRow]));
    mockInsert.mockReturnValueOnce(makeInsertChain([itemRow]));

    const result = await createRentalItem(USER_ID, {
      name:        'Golden Arch Decor',
      category:    'DECOR',
      pricePerDay: 500,
      deposit:     200,
      stockQty:    5,
    });

    expect(result.name).toBe('Golden Arch Decor');
    expect(result.vendorId).toBe(VENDOR_ID);
  });

  it('rejects non-vendor (no row in vendors for userId) with FORBIDDEN', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([])); // no vendor row

    await expect(
      createRentalItem(USER_ID, {
        name:        'Test Item',
        category:    'FURNITURE',
        pricePerDay: 300,
        deposit:     0,
        stockQty:    1,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ── createRentalBooking ───────────────────────────────────────────────────────

describe('createRentalBooking', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('totalAmount = days × pricePerDay × quantity (3 days × ₹500 × 2 = ₹3000)', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChainResolvable([itemRow]))             // fetch item
      .mockReturnValueOnce(makeSelectChainResolvable([{ reserved: 0 }]));   // no overlaps

    mockInsert.mockReturnValueOnce(makeInsertChain([bookingRow]));

    const result = await createRentalBooking(USER_ID, {
      rentalItemId: ITEM_ID,
      fromDate:     '2026-05-01',
      toDate:       '2026-05-04', // 3 days
      quantity:     2,
    });

    expect(result.totalAmount).toBe(3000);
    expect(result.depositPaid).toBe(400); // 200 × 2
  });

  it('rejects when overlapping booking sum >= stockQty with CONFLICT', async () => {
    // stockQty = 5, already reserved = 4, requesting qty = 2 → 4+2=6 > 5
    mockSelect
      .mockReturnValueOnce(makeSelectChainResolvable([itemRow]))              // item (stockQty:5)
      .mockReturnValueOnce(makeSelectChainResolvable([{ reserved: 4 }]));    // 4 already reserved

    await expect(
      createRentalBooking(USER_ID, {
        rentalItemId: ITEM_ID,
        fromDate:     '2026-05-01',
        toDate:       '2026-05-04',
        quantity:     2,
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects when fromDate >= toDate with VALIDATION', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([itemRow]));

    await expect(
      createRentalBooking(USER_ID, {
        rentalItemId: ITEM_ID,
        fromDate:     '2026-05-04',
        toDate:       '2026-05-01', // toDate before fromDate
        quantity:     1,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

// ── confirmRentalBooking ──────────────────────────────────────────────────────

describe('confirmRentalBooking', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const confirmedRow = { ...bookingRow, status: 'CONFIRMED' };

  it('confirms a PENDING booking when called by vendor', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([{
      booking:      bookingRow,
      item:         itemRow,
      vendorUserId: USER_ID,
    }]));
    mockUpdate.mockReturnValueOnce(makeUpdateChain([confirmedRow]));

    const result = await confirmRentalBooking(USER_ID, BOOKING_ID);
    expect(result.status).toBe('CONFIRMED');
  });

  it('rejects when called by wrong vendor (FORBIDDEN)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([{
      booking:      bookingRow,
      item:         itemRow,
      vendorUserId: 'different-vendor-user-id',
    }]));

    await expect(confirmRentalBooking(USER_ID, BOOKING_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects non-PENDING booking (INVALID_STATE)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([{
      booking:      { ...bookingRow, status: 'CONFIRMED' },
      item:         itemRow,
      vendorUserId: USER_ID,
    }]));

    await expect(confirmRentalBooking(USER_ID, BOOKING_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
});

// ── returnRentalItem ──────────────────────────────────────────────────────────

describe('returnRentalItem', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('marks ACTIVE booking as RETURNED', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([{
      booking:      { ...bookingRow, status: 'ACTIVE' },
      item:         itemRow,
      vendorUserId: USER_ID,
    }]));
    mockUpdate.mockReturnValueOnce(makeUpdateChain([{ ...bookingRow, status: 'RETURNED' }]));

    const result = await returnRentalItem(USER_ID, BOOKING_ID);
    expect(result.status).toBe('RETURNED');
  });

  it('rejects non-ACTIVE booking with INVALID_STATE', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([{
      booking:      bookingRow, // status: PENDING
      item:         itemRow,
      vendorUserId: USER_ID,
    }]));

    await expect(returnRentalItem(USER_ID, BOOKING_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
});

// ── getMyRentalBookings ───────────────────────────────────────────────────────

describe('getMyRentalBookings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('filters by customerId and returns RentalBookingSummary[]', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([{
      booking:  bookingRow,
      itemName: 'Golden Arch Decor',
    }]));

    const result = await getMyRentalBookings(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]!.itemName).toBe('Golden Arch Decor');
    expect(result[0]!.status).toBe('PENDING');
  });

  it('returns empty array when user has no bookings', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChainResolvable([]));

    const result = await getMyRentalBookings('user-with-no-bookings');
    expect(result).toHaveLength(0);
  });
});
