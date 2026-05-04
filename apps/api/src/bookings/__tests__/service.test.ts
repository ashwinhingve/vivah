/**
 * Booking service unit tests.
 * All DB calls and BullMQ are mocked — no real I/O.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Static mocks (hoisted before imports) ─────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  // Pass through — the txn callback gets the same stubbed `db` surface so
  // nested updates/inserts hit the module-level mocks.
  return fn({ select: mockSelect, insert: mockInsert, update: mockUpdate });
});

vi.mock('../../lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate, transaction: mockTransaction },
}));

vi.mock('@smartshaadi/db', () => ({
  bookings:           {},
  payments:           {},
  escrowAccounts:     {},
  vendors:            {},
  bookingAddons:      { bookingId: {} },
  vendorReviews:      { id: {}, bookingId: {} },
  vendorBlockedDates: { id: {}, vendorId: {}, date: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq:      vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:     vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((_col: unknown, values: unknown[]) => ({ type: 'inArray', values })),
  desc:    vi.fn((_col: unknown) => ({ type: 'desc' })),
  sql:     vi.fn(() => ({ type: 'sql' })),
}));

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
}));

vi.mock('../../infrastructure/redis/queues.js', () => ({
  escrowReleaseQueue: { add: mockQueueAdd },
  notificationsQueue: { add: mockQueueAdd },
  orderExpiryQueue:   { add: vi.fn() },
  DEFAULT_JOB_OPTS:   {},
  connection:         {},
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    REDIS_URL:         'redis://localhost:6379',
    USE_MOCK_SERVICES: true,
  },
}));

const mockCreateRefund = vi.fn().mockResolvedValue({ id: 'mock_refund_1', amount: 5000, status: 'processed' });
vi.mock('../../lib/razorpay.js', () => ({
  createRefund: (...args: unknown[]) => mockCreateRefund(...args),
}));

// ── DB query builder mock ────────────────────────────────────────────────────

type SelectResult = Record<string, unknown>[];

function makeQueryChain(rows: SelectResult) {
  const chain: Record<string, unknown> = {};
  chain.from    = vi.fn().mockReturnValue(chain);
  chain.where   = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit   = vi.fn().mockResolvedValue(rows);
  chain.offset  = vi.fn().mockResolvedValue(rows);
  // Allow `await db.select().from().where()` (no .limit) for new addon/review fetches
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return chain;
}

function makeInsertChain(row: Record<string, unknown>) {
  return {
    values:     vi.fn().mockReturnThis(),
    returning:  vi.fn().mockResolvedValue([row]),
  };
}

function makeUpdateChain(row: Record<string, unknown>) {
  return {
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CUSTOMER_ID  = 'user-customer-1';
const VENDOR_USER_ID = 'user-vendor-1';
const VENDOR_ID    = 'vendor-uuid-1';
const BOOKING_ID   = 'booking-uuid-1';
const SERVICE_ID   = 'service-uuid-1';
const EVENT_DATE   = '2026-06-15';

const baseBooking = {
  id:           BOOKING_ID,
  customerId:   CUSTOMER_ID,
  vendorId:     VENDOR_ID,
  serviceId:    SERVICE_ID,
  eventDate:    EVENT_DATE,
  ceremonyType: 'WEDDING',
  status:       'PENDING',
  totalAmount:  '50000',
  notes:        null,
  createdAt:    new Date('2026-04-17T00:00:00Z'),
  updatedAt:    new Date('2026-04-17T00:00:00Z'),
};

const baseVendor = {
  id:           VENDOR_ID,
  userId:       VENDOR_USER_ID,
  businessName: 'Raj Photography',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('bookings/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createBooking: conflict detection ──────────────────────────────────────

  describe('createBooking', () => {
    it('throws BOOKING_CONFLICT when vendor is already CONFIRMED for that date', async () => {
      // Arrange — conflict query returns a row (existing confirmed booking)
      mockSelect.mockImplementation(() =>
        makeQueryChain([{ id: 'existing-booking' }]),
      );

      const { createBooking } = await import('../service.js');

      // Act & Assert
      await expect(
        createBooking(CUSTOMER_ID, {
          vendorId:    VENDOR_ID,
          eventDate:   EVENT_DATE,
          totalAmount: 50000,
        }),
      ).rejects.toMatchObject({
        code:    'BOOKING_CONFLICT',
        message: expect.stringContaining('already booked'),
      });
    });

    it('creates booking and returns summary when no conflict', async () => {
      const calls: SelectResult[] = [
        [],             // conflict check → no conflict
        [],             // blocked-date check → not blocked
        [baseVendor],   // notify vendor — get vendor userId
        [baseVendor],   // toBookingSummary — get vendor name
        [],             // toBookingSummary — no escrow yet
        [],             // toBookingSummary — no addons
        [],             // toBookingSummary — no existing review
      ];
      let callIndex = 0;

      mockSelect.mockImplementation(() =>
        makeQueryChain(calls[callIndex++] ?? []),
      );

      mockInsert.mockImplementation(() =>
        makeInsertChain(baseBooking),
      );

      const { createBooking } = await import('../service.js');

      const result = await createBooking(CUSTOMER_ID, {
        vendorId:    VENDOR_ID,
        eventDate:   EVENT_DATE,
        totalAmount: 50000,
      });

      expect(result.id).toBe(BOOKING_ID);
      expect(result.status).toBe('PENDING');
      expect(result.totalAmount).toBe(50000);
    });

    it('translates Postgres 23505 unique-violation to BOOKING_CONFLICT (race-loser path)', async () => {
      // Application-level conflict check passes (no rows), but the partial
      // unique index `booking_active_unique_idx` trips on insert because a
      // concurrent transaction wrote first. The driver throws { code: '23505' }
      // and the service must translate it.
      mockSelect.mockImplementation(() => makeQueryChain([])); // no app-level conflict

      const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint "booking_active_unique_idx"'), { code: '23505' });
      mockInsert.mockImplementation(() => ({
        values:    vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(uniqueViolation),
      }));

      const { createBooking } = await import('../service.js');

      await expect(
        createBooking(CUSTOMER_ID, {
          vendorId:    VENDOR_ID,
          eventDate:   EVENT_DATE,
          totalAmount: 50000,
        }),
      ).rejects.toMatchObject({
        code:    'BOOKING_CONFLICT',
        message: expect.stringContaining('already booked'),
      });
    });

    it('rethrows non-23505 errors without translation', async () => {
      mockSelect.mockImplementation(() => makeQueryChain([]));

      const otherError = Object.assign(new Error('connection terminated'), { code: '57P01' });
      mockInsert.mockImplementation(() => ({
        values:    vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(otherError),
      }));

      const { createBooking } = await import('../service.js');

      await expect(
        createBooking(CUSTOMER_ID, {
          vendorId:    VENDOR_ID,
          eventDate:   EVENT_DATE,
          totalAmount: 50000,
        }),
      ).rejects.toMatchObject({ code: '57P01' });
    });
  });

  // ── confirmBooking: wrong vendor ───────────────────────────────────────────

  describe('confirmBooking', () => {
    it('throws FORBIDDEN when userId does not match booking vendor', async () => {
      const calls: SelectResult[] = [
        [{ id: 'other-vendor-id', userId: 'other-user' }], // vendor record for the caller
        [{ ...baseBooking, vendorId: VENDOR_ID }],          // the booking has different vendorId
      ];
      let callIndex = 0;

      mockSelect.mockImplementation(() =>
        makeQueryChain(calls[callIndex++] ?? []),
      );

      const { confirmBooking } = await import('../service.js');

      await expect(
        confirmBooking('some-other-user-id', BOOKING_ID),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('throws FORBIDDEN when no vendor account found for userId', async () => {
      mockSelect.mockImplementation(() =>
        makeQueryChain([]), // no vendor found
      );

      const { confirmBooking } = await import('../service.js');

      await expect(
        confirmBooking('unknown-user', BOOKING_ID),
      ).rejects.toMatchObject({
        code:    'FORBIDDEN',
        message: expect.stringContaining('No vendor account'),
      });
    });
  });

  // ── completeBooking: Bull job with 48h delay ───────────────────────────────

  describe('completeBooking', () => {
    it('enqueues escrow-release Bull job with 48h delay and correct payload', async () => {
      const confirmedBooking = { ...baseBooking, status: 'CONFIRMED' };
      const escrowRow = {
        id:        'escrow-uuid-1',
        totalHeld: '25000', // 50% of 50000
      };

      const calls: SelectResult[] = [
        [confirmedBooking],                          // booking lookup
        [{ userId: VENDOR_USER_ID }],                // vendor auth check
        [escrowRow],                                 // escrow lookup
        [baseVendor],                                // toBookingSummary — vendor name
        [],                                          // toBookingSummary — escrow for summary
        [],                                          // toBookingSummary — addons
        [],                                          // toBookingSummary — review check
      ];
      let callIndex = 0;

      mockSelect.mockImplementation(() =>
        makeQueryChain(calls[callIndex++] ?? []),
      );

      mockUpdate.mockImplementation(() =>
        makeUpdateChain({ ...confirmedBooking, status: 'COMPLETED' }),
      );

      const { completeBooking } = await import('../service.js');
      await completeBooking(VENDOR_USER_ID, BOOKING_ID);

      // Verify Bull job was enqueued
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'release-escrow',
        expect.objectContaining({
          escrowId:  'escrow-uuid-1',
          bookingId: BOOKING_ID,
          vendorId:  VENDOR_ID,
          amount:    25000,
        }),
        expect.objectContaining({
          delay: 48 * 60 * 60 * 1000,
        }),
      );
    });

    it('uses 50% of totalAmount when no escrow record exists', async () => {
      const confirmedBooking = { ...baseBooking, status: 'CONFIRMED', totalAmount: '100000' };

      const calls: SelectResult[] = [
        [confirmedBooking],               // booking
        [{ userId: VENDOR_USER_ID }],     // vendor auth check
        [],                               // no escrow yet
        [baseVendor],                     // toBookingSummary
        [],                               // summary escrow
        [],                               // summary addons
        [],                               // summary review
      ];
      let callIndex = 0;

      mockSelect.mockImplementation(() =>
        makeQueryChain(calls[callIndex++] ?? []),
      );
      mockUpdate.mockImplementation(() =>
        makeUpdateChain({ ...confirmedBooking, status: 'COMPLETED' }),
      );

      const { completeBooking } = await import('../service.js');
      await completeBooking(VENDOR_USER_ID, BOOKING_ID);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'release-escrow',
        expect.objectContaining({
          escrowId: null,
          amount:   50000, // 50% of 100000
        }),
        expect.objectContaining({ delay: 48 * 60 * 60 * 1000 }),
      );
    });
  });

  // ── cancelBooking: refund when escrow HELD ────────────────────────────────

  describe('cancelBooking', () => {
    it('calls createRefund when escrow status is HELD', async () => {
      const confirmedBooking = { ...baseBooking, status: 'CONFIRMED' };
      const escrowRow = { id: 'escrow-1', totalHeld: '25000', status: 'HELD' };
      const paymentRow = { id: 'payment-1', razorpayPaymentId: 'pay_test123' };

      const calls: SelectResult[] = [
        [confirmedBooking],                   // booking lookup
        [{ id: VENDOR_ID, userId: VENDOR_USER_ID }], // vendor lookup for auth check
        [escrowRow],                          // escrow lookup
        [paymentRow],                         // payment lookup for razorpayPaymentId
        [baseVendor],                         // toBookingSummary vendor
        [],                                   // toBookingSummary escrow
        [],                                   // toBookingSummary addons
        [],                                   // toBookingSummary review
      ];
      let callIndex = 0;

      mockSelect.mockImplementation(() =>
        makeQueryChain(calls[callIndex++] ?? []),
      );
      mockUpdate.mockImplementation(() =>
        makeUpdateChain({ ...confirmedBooking, status: 'CANCELLED' }),
      );

      const { cancelBooking } = await import('../service.js');
      await cancelBooking(CUSTOMER_ID, BOOKING_ID, 'Changed plans');

      // Razorpay requires paise — 25000 rupees → 2_500_000 paise.
      expect(mockCreateRefund).toHaveBeenCalledWith('pay_test123', 2_500_000);
    });

    it('does NOT call createRefund when no escrow is HELD', async () => {
      const calls: SelectResult[] = [
        [baseBooking],                              // booking
        [{ id: VENDOR_ID, userId: VENDOR_USER_ID }], // vendor
        [],                                          // no escrow
        [baseVendor],                                // toBookingSummary
        [],                                          // summary escrow
        [],                                          // summary addons
        [],                                          // summary review
      ];
      let callIndex = 0;

      mockSelect.mockImplementation(() =>
        makeQueryChain(calls[callIndex++] ?? []),
      );
      mockUpdate.mockImplementation(() =>
        makeUpdateChain({ ...baseBooking, status: 'CANCELLED' }),
      );

      const { cancelBooking } = await import('../service.js');
      await cancelBooking(CUSTOMER_ID, BOOKING_ID);

      expect(mockCreateRefund).not.toHaveBeenCalled();
    });
  });

  // ── Export surface ─────────────────────────────────────────────────────────

  it('exports all required functions', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.createBooking).toBe('function');
    expect(typeof mod.confirmBooking).toBe('function');
    expect(typeof mod.cancelBooking).toBe('function');
    expect(typeof mod.completeBooking).toBe('function');
    expect(typeof mod.getBookings).toBe('function');
    expect(typeof mod.getBooking).toBe('function');
  });
});
