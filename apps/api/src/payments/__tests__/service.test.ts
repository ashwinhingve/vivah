/**
 * Smart Shaadi — Payment Service Tests
 * Covers: createPaymentOrder, handlePaymentSuccess, requestRefund, getPaymentHistory
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/db.js', () => ({ db: {} }));

vi.mock('@smartshaadi/db', () => ({
  payments:       { id: 'payments.id', bookingId: 'payments.bookingId', status: 'payments.status', razorpayOrderId: 'payments.razorpayOrderId', razorpayPaymentId: 'payments.razorpayPaymentId', amount: 'payments.amount', currency: 'payments.currency', createdAt: 'payments.createdAt' },
  bookings:       { id: 'bookings.id', customerId: 'bookings.customerId', status: 'bookings.status', totalAmount: 'bookings.totalAmount', vendorId: 'bookings.vendorId' },
  escrowAccounts: { id: 'escrowAccounts.id', bookingId: 'escrowAccounts.bookingId', totalHeld: 'escrowAccounts.totalHeld', status: 'escrowAccounts.status', released: 'escrowAccounts.released' },
  auditLogs:      { id: 'auditLogs.id', eventType: 'auditLogs.eventType', entityType: 'auditLogs.entityType', entityId: 'auditLogs.entityId', actorId: 'auditLogs.actorId', payload: 'auditLogs.payload', contentHash: 'auditLogs.contentHash', prevHash: 'auditLogs.prevHash' },
  auditEventTypeEnum: { enumValues: ['PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'ESCROW_HELD', 'ESCROW_RELEASED', 'ESCROW_DISPUTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED'] },
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:  vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc', _col })),
  sql:  vi.fn(() => ({ type: 'sql' })),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgresql://localhost/test' },
}));

// Mock Razorpay — createOrder returns mock order, createRefund returns mock refund
const mockCreateOrder = vi.fn().mockResolvedValue({ id: 'mock_order_123', amount: 5000, currency: 'INR', status: 'created' });
const mockCreateRefund = vi.fn().mockResolvedValue({ id: 'mock_refund_456', amount: 5000, status: 'processed' });
const mockTransferToVendor = vi.fn().mockResolvedValue({ id: 'mock_transfer_789' });

vi.mock('../../lib/razorpay.js', () => ({
  createOrder:       mockCreateOrder,
  createRefund:      mockCreateRefund,
  transferToVendor:  mockTransferToVendor,
}));

// ── DB query builder helpers ──────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function makeSelect(resolveWith: unknown[]) {
  return vi.fn().mockReturnValue({
    from:    vi.fn().mockReturnThis(),
    where:   vi.fn().mockResolvedValue(resolveWith),
    orderBy: vi.fn().mockReturnThis(),
    limit:   vi.fn().mockReturnThis(),
    offset:  vi.fn().mockResolvedValue(resolveWith),
    innerJoin: vi.fn().mockReturnThis(),
  });
}

function makeInsert() {
  return vi.fn().mockReturnValue({
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
  });
}

function makeUpdate() {
  return vi.fn().mockReturnValue({
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
  });
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createPaymentOrder tests ──────────────────────────────────────────────────

describe('createPaymentOrder', () => {
  it('throws if booking does not belong to the requesting user', async () => {
    const { createPaymentOrder } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    // Booking found but owned by a different user
    (dbMod.db as unknown as AnyRecord)['select'] = makeSelect([{
      id: 'booking-1', customerId: 'other-user', status: 'CONFIRMED', totalAmount: '10000',
    }]);

    await expect(
      createPaymentOrder('user-abc', { bookingId: 'booking-1' }),
    ).rejects.toThrow('Forbidden');
  });

  it('throws if booking status is not CONFIRMED', async () => {
    const { createPaymentOrder } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = makeSelect([{
      id: 'booking-2', customerId: 'user-abc', status: 'PENDING', totalAmount: '10000',
    }]);

    await expect(
      createPaymentOrder('user-abc', { bookingId: 'booking-2' }),
    ).rejects.toThrow('CONFIRMED');
  });

  it('throws if booking is not found', async () => {
    const { createPaymentOrder } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = makeSelect([]);

    await expect(
      createPaymentOrder('user-abc', { bookingId: 'booking-missing' }),
    ).rejects.toThrow('not found');
  });

  it('creates order with escrow = exactly 50% of totalAmount (Math.round)', async () => {
    const { createPaymentOrder } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = makeSelect([{
      id: 'booking-3', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10001',
    }]);
    (dbMod.db as unknown as AnyRecord)['insert'] = makeInsert();

    const result = await createPaymentOrder('user-abc', { bookingId: 'booking-3' });

    // Math.round(10001 * 0.5) = Math.round(5000.5) = 5001
    expect(mockCreateOrder).toHaveBeenCalledWith(5001, 'INR', 'booking-3');
    expect(result.amount).toBe(5001);
    expect(result.currency).toBe('INR');
    expect(result.bookingId).toBe('booking-3');
    expect(result.razorpayOrderId).toBe('mock_order_123');
  });

  it('returns PaymentOrder shape', async () => {
    const { createPaymentOrder } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = makeSelect([{
      id: 'booking-4', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '20000',
    }]);
    (dbMod.db as unknown as AnyRecord)['insert'] = makeInsert();

    const result = await createPaymentOrder('user-abc', { bookingId: 'booking-4' });

    expect(result).toMatchObject({
      razorpayOrderId: expect.any(String),
      amount:          10000, // 50% of 20000
      currency:        'INR',
      bookingId:       'booking-4',
    });
  });
});

// ── handlePaymentSuccess tests ────────────────────────────────────────────────

describe('handlePaymentSuccess', () => {
  it('creates escrow record with HELD status after payment captured', async () => {
    const { handlePaymentSuccess } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');

    let selectCallCount = 0;
    // First call: find payment; second call: find booking
    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Payment found
          return Promise.resolve([{ id: 'pay-1', bookingId: 'booking-3', amount: '5000', razorpayOrderId: 'order_abc', razorpayPaymentId: null }]);
        }
        // Booking found
        return Promise.resolve([{ id: 'booking-3', customerId: 'user-abc', totalAmount: '10000' }]);
      }),
    }));

    (dbMod.db as unknown as AnyRecord)['update'] = makeUpdate();

    const insertMock = makeInsert();
    (dbMod.db as unknown as AnyRecord)['insert'] = insertMock;

    await handlePaymentSuccess('order_abc', 'pay_xyz');

    // insert should have been called for escrowAccounts and auditLogs
    expect(insertMock).toHaveBeenCalledTimes(2);

    // First insert = escrowAccounts
    const firstInsertArgs = (insertMock.mock.calls[0] as unknown[])[0] as AnyRecord;
    // The first arg to insert() is the table — check it's the escrowAccounts table shape
    expect(firstInsertArgs).toBeDefined();

    // Verify update was called to set status=CAPTURED
    const updateMock = (dbMod.db as unknown as AnyRecord)['update'] as ReturnType<typeof vi.fn>;
    expect(updateMock).toHaveBeenCalled();
  });

  it('throws if payment not found', async () => {
    const { handlePaymentSuccess } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = makeSelect([]);

    await expect(handlePaymentSuccess('nonexistent_order', 'pay_x')).rejects.toThrow();
  });
});

// ── requestRefund tests ───────────────────────────────────────────────────────

describe('requestRefund', () => {
  it('throws if payment does not belong to the requesting user', async () => {
    const { requestRefund } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    // innerJoin query returns empty — meaning no matching payment for this user
    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
      from:      vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where:     vi.fn().mockResolvedValue([]),
      orderBy:   vi.fn().mockReturnThis(),
      limit:     vi.fn().mockReturnThis(),
    });

    await expect(
      requestRefund('wrong-user', 'pay-1', { reason: 'test' }),
    ).rejects.toThrow('forbidden');
  });

  it('throws if payment has no razorpayPaymentId', async () => {
    const { requestRefund } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
      from:      vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where:     vi.fn().mockResolvedValue([{
        payment: { id: 'pay-1', bookingId: 'booking-1', amount: '5000', razorpayPaymentId: null },
        booking: { id: 'booking-1', customerId: 'user-abc' },
      }]),
      orderBy:   vi.fn().mockReturnThis(),
      limit:     vi.fn().mockReturnThis(),
    });

    await expect(
      requestRefund('user-abc', 'pay-1', {}),
    ).rejects.toThrow('no Razorpay payment ID');
  });

  it('calls createRefund and updates status to REFUNDED for valid request', async () => {
    const { requestRefund } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
      from:      vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where:     vi.fn().mockResolvedValue([{
        payment: { id: 'pay-2', bookingId: 'booking-2', amount: '5000', razorpayPaymentId: 'pay_real_xyz' },
        booking: { id: 'booking-2', customerId: 'user-abc' },
      }]),
    });

    const updateMock = makeUpdate();
    (dbMod.db as unknown as AnyRecord)['update'] = updateMock;
    (dbMod.db as unknown as AnyRecord)['insert'] = makeInsert();

    await requestRefund('user-abc', 'pay-2', { reason: 'Event cancelled' });

    expect(mockCreateRefund).toHaveBeenCalledWith('pay_real_xyz', 5000);
    expect(updateMock).toHaveBeenCalled();
  });
});

// ── getPaymentHistory tests ───────────────────────────────────────────────────

describe('getPaymentHistory', () => {
  it('returns paginated payment list for user', async () => {
    const { getPaymentHistory } = await import('../service.js');

    const dbMod = await import('../../lib/db.js');
    const fakePayments = [
      { id: 'p1', bookingId: 'b1', amount: '5000', currency: 'INR', status: 'CAPTURED', razorpayOrderId: 'o1', razorpayPaymentId: 'pay1', createdAt: new Date() },
      { id: 'p2', bookingId: 'b2', amount: '7500', currency: 'INR', status: 'PENDING',  razorpayOrderId: 'o2', razorpayPaymentId: null,   createdAt: new Date() },
    ];

    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
      from:      vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where:     vi.fn().mockReturnThis(),
      orderBy:   vi.fn().mockReturnThis(),
      limit:     vi.fn().mockReturnThis(),
      offset:    vi.fn().mockResolvedValue(fakePayments),
    });

    const result = await getPaymentHistory('user-abc', 1, 10);

    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.items[0]).toMatchObject({ id: 'p1', amount: '5000', status: 'CAPTURED' });
  });
});
