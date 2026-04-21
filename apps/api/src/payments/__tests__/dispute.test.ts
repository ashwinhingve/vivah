/**
 * Smart Shaadi — Dispute Service Tests
 *
 * Covers:
 *   raiseDispute: non-customer rejected, non-HELD escrow rejected,
 *                 Bull cancel called BEFORE status update, audit_log appended
 *   resolveDispute: non-admin rejected, RELEASE, REFUND, SPLIT 0.6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

// transaction mock — runs callback with a tx object that has update (same mockUpdate)
const mockTxUpdate = vi.fn();
const mockDbTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
  const tx = { update: mockTxUpdate };
  return cb(tx);
});

vi.mock('../../lib/db.js', () => ({
  db: {
    select:      mockDbSelect,
    insert:      mockDbInsert,
    update:      mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));

vi.mock('@smartshaadi/db', () => ({
  bookings:       { id: 'bookings.id', customerId: 'bookings.customerId', status: 'bookings.status', totalAmount: 'bookings.totalAmount', vendorId: 'bookings.vendorId', createdAt: 'bookings.createdAt' },
  escrowAccounts: { id: 'escrowAccounts.id', bookingId: 'escrowAccounts.bookingId', status: 'escrowAccounts.status', totalHeld: 'escrowAccounts.totalHeld', released: 'escrowAccounts.released', releasedAt: 'escrowAccounts.releasedAt' },
  payments:       { id: 'payments.id', bookingId: 'payments.bookingId', status: 'payments.status', razorpayPaymentId: 'payments.razorpayPaymentId' },
  user:           { id: 'user.id', role: 'user.role', name: 'user.name' },
  auditLogs:      { id: 'auditLogs.id', eventType: 'auditLogs.eventType', entityType: 'auditLogs.entityType', entityId: 'auditLogs.entityId', actorId: 'auditLogs.actorId', payload: 'auditLogs.payload', contentHash: 'auditLogs.contentHash', prevHash: 'auditLogs.prevHash', createdAt: 'auditLogs.createdAt' },
  auditEventTypeEnum: { enumValues: ['PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REFUND_ISSUED', 'ESCROW_HELD', 'ESCROW_RELEASED', 'ESCROW_DISPUTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'CONTRACT_SIGNED', 'VENDOR_APPROVED', 'PROFILE_BLOCKED', 'USER_REGISTERED', 'USER_VERIFIED', 'USER_SUSPENDED', 'KYC_SUBMITTED', 'KYC_VERIFIED', 'KYC_REJECTED', 'MATCH_ACCEPTED'] },
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:  vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc', _col })),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgresql://localhost/test' },
}));

const mockTransferToVendor = vi.fn().mockResolvedValue({ id: 'mock_transfer_789' });
const mockCreateRefund     = vi.fn().mockResolvedValue({ id: 'mock_refund_456', amount: 5000, status: 'processed' });

vi.mock('../../lib/razorpay.js', () => ({
  createRefund:     mockCreateRefund,
  transferToVendor: mockTransferToVendor,
}));

// Bull queue mock
const mockGetDelayed = vi.fn().mockResolvedValue([]);
const mockJobRemove  = vi.fn().mockResolvedValue(undefined);
const mockQueueAdd   = vi.fn().mockResolvedValue({ id: 'job-1' });

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getDelayed: mockGetDelayed,
    add:        mockQueueAdd,
  })),
}));

// Spy on appendAuditLog (exported from payments/service.ts)
const mockAppendAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('../service.js', () => ({
  appendAuditLog: mockAppendAuditLog,
}));

// ── DB chain helpers ──────────────────────────────────────────────────────────

function makeSelect(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then(onfulfilled: ((v: unknown) => unknown) | null | undefined) {
      return Promise.resolve(rows).then(onfulfilled ?? undefined);
    },
  };
  chain['from']       = vi.fn().mockReturnValue(chain);
  chain['where']      = vi.fn().mockReturnValue(chain);
  chain['orderBy']    = vi.fn().mockReturnValue(chain);
  chain['limit']      = vi.fn().mockReturnValue(chain);
  chain['offset']     = vi.fn().mockReturnValue(chain);
  chain['innerJoin']  = vi.fn().mockReturnValue(chain);
  chain['leftJoin']   = vi.fn().mockReturnValue(chain);
  return vi.fn().mockReturnValue(chain);
}

function makeUpdate() {
  const chain: Record<string, unknown> = {};
  chain['set']   = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockResolvedValue([]);
  return vi.fn().mockReturnValue(chain);
}

function makeInsert() {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([]),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDbInsert.mockImplementation(makeInsert());
  mockTxUpdate.mockImplementation(makeUpdate());
});

// ── raiseDispute tests ────────────────────────────────────────────────────────

describe('raiseDispute', () => {
  it('rejects non-customer with FORBIDDEN error', async () => {
    const { raiseDispute } = await import('../dispute.js');

    // Booking found but owned by a different user
    mockDbSelect.mockImplementationOnce(
      makeSelect([{ id: 'bk-1', customerId: 'other-user', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
    );

    await expect(
      raiseDispute('user-abc', 'bk-1', { reason: 'Product was damaged on arrival' }),
    ).rejects.toThrow('Forbidden');
  });

  it('rejects non-HELD escrow with INVALID_STATE error', async () => {
    const { raiseDispute } = await import('../dispute.js');

    // Booking owned by user
    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-2', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      // Escrow NOT held
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-1', bookingId: 'bk-2', status: 'RELEASED', totalHeld: '5000' }]),
      );

    await expect(
      raiseDispute('user-abc', 'bk-2', { reason: 'Product was damaged on arrival' }),
    ).rejects.toThrow('Invalid state');
  });

  it('calls Bull cancel BEFORE status update (ordering test)', async () => {
    const { raiseDispute } = await import('../dispute.js');

    const callOrder: string[] = [];

    // getDelayed returns a matching job
    mockGetDelayed.mockImplementation(async () => {
      callOrder.push('getDelayed');
      return [{ data: { bookingId: 'bk-3' }, remove: mockJobRemove }];
    });
    mockJobRemove.mockImplementation(async () => {
      callOrder.push('jobRemove');
    });
    mockTxUpdate.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain['set']   = vi.fn().mockReturnValue(chain);
      chain['where'] = vi.fn().mockImplementation(async () => {
        callOrder.push('statusUpdate');
        return [];
      });
      return chain;
    });

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-3', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-3', bookingId: 'bk-3', status: 'HELD', totalHeld: '5000' }]),
      );

    await raiseDispute('user-abc', 'bk-3', { reason: 'Vendor did not show up to the event' });

    // Verify Bull cancel happened before status update
    const cancelIdx = callOrder.indexOf('jobRemove');
    const updateIdx = callOrder.indexOf('statusUpdate');
    expect(cancelIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(cancelIdx);
  });

  it('appends audit_log with ESCROW_DISPUTED after raising dispute', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-4', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-4', bookingId: 'bk-4', status: 'HELD', totalHeld: '5000' }]),
      );

    await raiseDispute('user-abc', 'bk-4', { reason: 'The decorations were completely wrong' });

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType:  'ESCROW_DISPUTED',
        entityType: 'booking',
        entityId:   'bk-4',
        actorId:    'user-abc',
      }),
    );
  });

  it('returns {success:true, bookingId, status:DISPUTED}', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-5', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-5', bookingId: 'bk-5', status: 'HELD', totalHeld: '5000' }]),
      );

    const result = await raiseDispute('user-abc', 'bk-5', { reason: 'Service was not delivered at all' });

    expect(result).toEqual({ success: true, bookingId: 'bk-5', status: 'DISPUTED' });
  });
});

// ── resolveDispute tests ──────────────────────────────────────────────────────

describe('resolveDispute', () => {
  it('rejects non-admin user with FORBIDDEN error', async () => {
    const { resolveDispute } = await import('../dispute.js');

    // Non-admin user
    mockDbSelect.mockImplementationOnce(
      makeSelect([{ id: 'user-1', role: 'INDIVIDUAL' }]),
    );

    await expect(
      resolveDispute('user-1', 'bk-1', { resolution: 'RELEASE' }),
    ).rejects.toThrow('Forbidden');
  });

  it('RELEASE: escrow RELEASED + booking COMPLETED', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-r1', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-r1', bookingId: 'bk-r1', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-r1', bookingId: 'bk-r1', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_1' }]));

    const result = await resolveDispute('admin-1', 'bk-r1', { resolution: 'RELEASE' });

    expect(result.success).toBe(true);
    expect(result.resolution).toBe('RELEASE');
    expect(result.amounts.vendor).toBe(5000);
    expect(result.amounts.customer).toBe(0);

    // Audit log written for RELEASE
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ESCROW_RELEASED' }),
    );
  });

  it('REFUND: payment REFUNDED + booking CANCELLED', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-rf1', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-rf1', bookingId: 'bk-rf1', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-rf1', bookingId: 'bk-rf1', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_2' }]));

    const result = await resolveDispute('admin-1', 'bk-rf1', { resolution: 'REFUND' });

    expect(result.success).toBe(true);
    expect(result.resolution).toBe('REFUND');
    expect(result.amounts.vendor).toBe(0);
    expect(result.amounts.customer).toBe(5000);

    // Audit log written for REFUND
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'REFUND_ISSUED' }),
    );
  });

  it('SPLIT 0.6: vendor gets 60%, customer gets 40%, two audit_logs written', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-s1', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-s1', bookingId: 'bk-s1', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-s1', bookingId: 'bk-s1', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_3' }]));

    const result = await resolveDispute('admin-1', 'bk-s1', { resolution: 'SPLIT', splitRatio: 0.6 });

    expect(result.success).toBe(true);
    expect(result.resolution).toBe('SPLIT');
    expect(result.amounts.vendor).toBe(3000);   // 5000 * 0.6
    expect(result.amounts.customer).toBe(2000); // 5000 * 0.4

    // Two audit logs — one for vendor side, one for customer side
    expect(mockAppendAuditLog).toHaveBeenCalledTimes(2);
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ESCROW_RELEASED',
        payload:   expect.objectContaining({ side: 'VENDOR', vendorAmount: 3000 }),
      }),
    );
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REFUND_ISSUED',
        payload:   expect.objectContaining({ side: 'CUSTOMER', customerAmount: 2000 }),
      }),
    );
  });

  it('SPLIT rejects invalid splitRatio of 0', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-s2', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-s2', bookingId: 'bk-s2', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-s2', bookingId: 'bk-s2', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_4' }]));

    await expect(
      resolveDispute('admin-1', 'bk-s2', { resolution: 'SPLIT', splitRatio: 0 }),
    ).rejects.toThrow('splitRatio');
  });
});
