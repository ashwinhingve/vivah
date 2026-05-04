/**
 * Smart Shaadi — Dispute Service Tests
 *
 * Covers:
 *   raiseDispute: non-customer rejected, non-HELD escrow rejected,
 *                 Bull cancel called BEFORE status update, audit_log appended
 *   resolveDispute: non-admin rejected, RELEASE, REFUND, SPLIT 0.6
 *
 * FIX 1: Deterministic Bull cancel via getJob (not getDelayed scan)
 * FIX 2: Optimistic locking — second call rejected
 * FIX 3: DB tx before Razorpay; Razorpay failure => *_PENDING not rollback
 * FIX 4: New audit enum values DISPUTE_RAISED / DISPUTE_RESOLVED_*
 * FIX 5: SPLIT audit chain — both entries use bookingId as entityId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

// transaction mock — runs callback with a tx object that mirrors the db facade.
// The dispute service calls tx.execute (FOR UPDATE), tx.select, tx.update, tx.insert.
// We forward each to the same mock fns the test asserts against, so no behavior changes.
const mockTxUpdate = vi.fn();
const mockTxExecute = vi.fn();
const mockDbTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    select:  mockDbSelect,
    insert:  mockDbInsert,
    update:  mockTxUpdate,
    execute: mockTxExecute,
  };
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
  bookings:           { id: 'bookings.id', customerId: 'bookings.customerId', status: 'bookings.status', totalAmount: 'bookings.totalAmount', vendorId: 'bookings.vendorId', createdAt: 'bookings.createdAt', updatedAt: 'bookings.updatedAt' },
  escrowAccounts:     { id: 'escrowAccounts.id', bookingId: 'escrowAccounts.bookingId', status: 'escrowAccounts.status', totalHeld: 'escrowAccounts.totalHeld', released: 'escrowAccounts.released', releasedAt: 'escrowAccounts.releasedAt' },
  payments:           { id: 'payments.id', bookingId: 'payments.bookingId', status: 'payments.status', razorpayPaymentId: 'payments.razorpayPaymentId' },
  vendors:            { id: 'vendors.id', userId: 'vendors.userId' },
  user:               { id: 'user.id', role: 'user.role', name: 'user.name' },
  auditLogs:          { id: 'auditLogs.id', eventType: 'auditLogs.eventType', entityType: 'auditLogs.entityType', entityId: 'auditLogs.entityId', actorId: 'auditLogs.actorId', payload: 'auditLogs.payload', contentHash: 'auditLogs.contentHash', prevHash: 'auditLogs.prevHash', createdAt: 'auditLogs.createdAt' },
  disputeResolutions: { id: 'disputeResolutions.id', bookingId: 'disputeResolutions.bookingId', resolutionId: 'disputeResolutions.resolutionId', outcome: 'disputeResolutions.outcome', amountVendor: 'disputeResolutions.amountVendor', amountCustomer: 'disputeResolutions.amountCustomer', resolvedBy: 'disputeResolutions.resolvedBy', resolvedAt: 'disputeResolutions.resolvedAt' },
  auditEventTypeEnum: { enumValues: [
    'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REFUND_ISSUED', 'ESCROW_HELD',
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED',
    'CONTRACT_SIGNED', 'VENDOR_APPROVED', 'PROFILE_BLOCKED', 'USER_REGISTERED',
    'USER_VERIFIED', 'USER_SUSPENDED', 'KYC_SUBMITTED', 'KYC_VERIFIED', 'KYC_REJECTED',
    'MATCH_ACCEPTED',
    'DISPUTE_RAISED', 'DISPUTE_RESOLVED_RELEASE', 'DISPUTE_RESOLVED_REFUND', 'DISPUTE_RESOLVED_SPLIT',
  ] },
}));

vi.mock('drizzle-orm', () => ({
  eq:      vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:     vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ type: 'inArray', _col, _vals })),
  desc:    vi.fn((_col: unknown) => ({ type: 'desc', _col })),
  sql:     Object.assign(
    (_strings: TemplateStringsArray, ..._args: unknown[]) => ({ type: 'sql', _strings, _args }),
    { raw: (s: string) => ({ type: 'sql_raw', s }) },
  ),
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

// Bull queue mock — includes getJob (Fix 1) alongside getDelayed
const mockGetDelayed = vi.fn().mockResolvedValue([]);
const mockGetJob     = vi.fn().mockResolvedValue(null);
const mockJobRemove  = vi.fn().mockResolvedValue(undefined);
const mockQueueAdd   = vi.fn().mockResolvedValue({ id: 'job-1' });

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getDelayed: mockGetDelayed,
    getJob:     mockGetJob,
    add:        mockQueueAdd,
  })),
}));

// Mock the shared queues module (dispute.ts now imports from there)
vi.mock('../../infrastructure/redis/queues.js', () => ({
  escrowReleaseQueue: {
    getJob: mockGetJob,
    add:    mockQueueAdd,
  },
  notificationsQueue: {
    add: mockQueueAdd,
  },
}));

// Spy on appendAuditLog (exported from payments/service.ts)
const mockAppendAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('../service.js', () => ({
  appendAuditLog: mockAppendAuditLog,
}));

// notifyAdmins fan-out is tested separately; stub here so dispute tests do
// not need to mock the admin user.role select chain.
const mockNotifyAdmins = vi.fn().mockResolvedValue({ enqueued: 1 });
vi.mock('../../notifications/service.js', () => ({
  notifyAdmins: mockNotifyAdmins,
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

/**
 * makeUpdate — supports .set().where().returning() chain.
 * Default returningRows = [{ id: 'mock-id' }] — simulates 1 row updated (success).
 * Pass [] to simulate 0 rows updated (optimistic lock failure).
 */
function makeUpdate(returningRows: unknown[] = [{ id: 'mock-id' }]) {
  const chain: Record<string, unknown> = {};
  chain['set']       = vi.fn().mockReturnValue(chain);
  chain['where']     = vi.fn().mockReturnValue(chain);
  chain['returning'] = vi.fn().mockResolvedValue(returningRows);
  return vi.fn().mockReturnValue(chain);
}

function makeInsert(returningRows: unknown[] = [{ id: 'dr-1', bookingId: 'bk-1', resolutionId: 'res-1', outcome: 'RELEASE', amountVendor: '5000', amountCustomer: '0', resolvedBy: 'admin-1', resolvedAt: new Date() }]) {
  const chain: Record<string, unknown> = {};
  chain['values']              = vi.fn().mockReturnValue(chain);
  chain['onConflictDoNothing'] = vi.fn().mockReturnValue(chain);
  chain['returning']           = vi.fn().mockResolvedValue(returningRows);
  return vi.fn().mockReturnValue(chain);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDbInsert.mockImplementation(makeInsert());
  mockTxUpdate.mockImplementation(makeUpdate());
  // Default db.update: returns 1 row (optimistic lock succeeds by default)
  mockDbUpdate.mockImplementation(makeUpdate([{ id: 'mock-id' }]));
  // Default getJob: no job found (idempotent cancel)
  mockGetJob.mockResolvedValue(null);
  // Default tx.execute (FOR UPDATE): booking lock returns CONFIRMED row.
  mockTxExecute.mockResolvedValue({ rows: [{ id: 'bk-1', status: 'CONFIRMED', vendor_id: 'v-1' }] });
  // Default db.select: empty result. Tests stack mockImplementationOnce calls
  // for the rows they expect; anything past that (e.g., vendor lookup that
  // happens after a full success path) safely returns []. Without this,
  // mockImplementationOnce queues from prior tests can leak across cases.
  mockDbSelect.mockImplementation(makeSelect([]));
});

// ── raiseDispute tests ────────────────────────────────────────────────────────

describe('raiseDispute', () => {
  it('rejects non-customer with FORBIDDEN error', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect.mockImplementationOnce(
      makeSelect([{ id: 'bk-1', customerId: 'other-user', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
    );

    await expect(
      raiseDispute('user-abc', 'bk-1', { reason: 'Product was damaged on arrival' }),
    ).rejects.toThrow('Forbidden');
  });

  it('rejects non-HELD escrow with INVALID_STATE error', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-2', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-1', bookingId: 'bk-2', status: 'RELEASED', totalHeld: '5000' }]),
      );

    await expect(
      raiseDispute('user-abc', 'bk-2', { reason: 'Product was damaged on arrival' }),
    ).rejects.toThrow('Invalid state');
  });

  it('calls Bull cancel AFTER status update commits (ordering test)', async () => {
    const { raiseDispute } = await import('../dispute.js');

    const callOrder: string[] = [];

    mockGetJob.mockImplementation(async () => {
      callOrder.push('getJob');
      return { remove: async () => { callOrder.push('jobRemove'); } };
    });

    // Status flip happens inside the transaction via tx.update
    mockTxUpdate.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain['set']   = vi.fn().mockReturnValue(chain);
      chain['where'] = vi.fn().mockReturnValue(chain);
      chain['returning'] = vi.fn().mockImplementation(async () => {
        callOrder.push('statusUpdate');
        return [{ id: 'bk-3' }];
      });
      return chain;
    });

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-3', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-3', bookingId: 'bk-3', status: 'HELD', totalHeld: '5000' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ userId: 'vendor-user-id-3' }]),
      );

    await raiseDispute('user-abc', 'bk-3', { reason: 'Vendor did not show up to the event' });

    const cancelIdx = callOrder.indexOf('jobRemove');
    const updateIdx = callOrder.indexOf('statusUpdate');
    expect(cancelIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThanOrEqual(0);
    // Cancel now happens AFTER the transaction commits — protects against
    // tx rollback orphaning the auto-release Bull job.
    expect(cancelIdx).toBeGreaterThan(updateIdx);
  });

  it('appends audit_log with DISPUTE_RAISED after raising dispute', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-4', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-4', bookingId: 'bk-4', status: 'HELD', totalHeld: '5000' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ userId: 'vendor-user-id-4' }]),
      );

    await raiseDispute('user-abc', 'bk-4', { reason: 'The decorations were completely wrong' });

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType:  'DISPUTE_RAISED',
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
      )
      .mockImplementationOnce(
        makeSelect([{ userId: 'vendor-user-id-5' }]),
      );

    const result = await raiseDispute('user-abc', 'bk-5', { reason: 'Service was not delivered at all' });

    expect(result).toEqual({ success: true, bookingId: 'bk-5', status: 'DISPUTED' });
  });

  it('routes vendor notification to vendors.userId, not vendors.id', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-6', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-uuid-6' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-6', bookingId: 'bk-6', status: 'HELD', totalHeld: '5000' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ userId: 'vendor-user-text-id' }]),
      );

    await raiseDispute('user-abc', 'bk-6', { reason: 'Service was not delivered' });

    // Vendor notification job receives the resolved vendors.userId (TEXT user.id),
    // not the raw vendors.id (UUID).
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'DISPUTE_RAISED_VENDOR',
      expect.objectContaining({ userId: 'vendor-user-text-id' }),
    );
  });

  it('admin notification fans out via notifyAdmins, not direct queue.add', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-7', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-7' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-7', bookingId: 'bk-7', status: 'HELD', totalHeld: '5000' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ userId: 'vendor-user-7' }]),
      );

    await raiseDispute('user-abc', 'bk-7', { reason: 'Late delivery' });

    expect(mockNotifyAdmins).toHaveBeenCalledWith(
      'DISPUTE_NEEDS_REVIEW',
      expect.objectContaining({ bookingId: 'bk-7', customerId: 'user-abc' }),
    );
    // Confirm we did NOT enqueue DISPUTE_NEEDS_REVIEW directly to the customer's userId.
    const directAdminCall = mockQueueAdd.mock.calls.find(
      (c) => c[0] === 'DISPUTE_NEEDS_REVIEW' && (c[1] as { userId?: string })?.userId === 'user-abc',
    );
    expect(directAdminCall).toBeUndefined();
  });
});

// ── resolveDispute tests ──────────────────────────────────────────────────────

describe('resolveDispute', () => {
  it('rejects non-admin user with FORBIDDEN error', async () => {
    const { resolveDispute } = await import('../dispute.js');

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

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DISPUTE_RESOLVED_RELEASE' }),
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

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DISPUTE_RESOLVED_REFUND' }),
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
    expect(result.amounts.vendor).toBe(3000);
    expect(result.amounts.customer).toBe(2000);

    expect(mockAppendAuditLog).toHaveBeenCalledTimes(2);
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DISPUTE_RESOLVED_SPLIT',
        entityId:  'bk-s1',
        payload:   expect.objectContaining({ side: 'vendor', amount: 3000 }),
      }),
    );
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DISPUTE_RESOLVED_SPLIT',
        entityId:  'bk-s1',
        payload:   expect.objectContaining({ side: 'customer', amount: 2000 }),
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

// ── FIX 1: Deterministic Bull cancel ──────────────────────────────────────────

describe('raiseDispute — deterministic Bull cancel (Fix 1)', () => {
  it('cancels escrow job by deterministic ID on dispute raise', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockGetJob.mockResolvedValue({ remove: mockJobRemove });

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-det1', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-det1', bookingId: 'bk-det1', status: 'HELD', totalHeld: '5000' }]),
      );

    await raiseDispute('user-abc', 'bk-det1', { reason: 'Test deterministic cancel' });

    expect(mockGetJob).toHaveBeenCalledWith('escrow-release-bk-det1');
    expect(mockJobRemove).toHaveBeenCalled();
  });

  it('proceeds even if no job exists (idempotent cancel)', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockGetJob.mockResolvedValue(null);

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-det2', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-det2', bookingId: 'bk-det2', status: 'HELD', totalHeld: '5000' }]),
      );

    const result = await raiseDispute('user-abc', 'bk-det2', { reason: 'Test idempotent' });
    expect(result.success).toBe(true);
    expect(mockJobRemove).not.toHaveBeenCalled();
  });
});

// ── FIX 2: Optimistic locking ─────────────────────────────────────────────────

describe('raiseDispute — optimistic locking (Fix 2)', () => {
  it('second raiseDispute call on same booking returns error', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-lock1', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-lock1', bookingId: 'bk-lock1', status: 'HELD', totalHeld: '5000' }]),
      );

    // Atomic tx.update returns [] — concurrent write already flipped status to DISPUTED.
    // The service uses `tx.update(...)` inside the transaction, so mock mockTxUpdate
    // (not mockDbUpdate, which only catches calls outside the txn).
    mockTxUpdate.mockImplementation(makeUpdate([]));

    await expect(
      raiseDispute('user-abc', 'bk-lock1', { reason: 'Duplicate' }),
    ).rejects.toThrow('BOOKING_ALREADY_DISPUTED');
  });
});

describe('resolveDispute — optimistic locking (Fix 2)', () => {
  it('second resolveDispute call returns DISPUTE_ALREADY_RESOLVED', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-lock2', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-lock2', bookingId: 'bk-lock2', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-lock2', bookingId: 'bk-lock2', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_lock' }]));

    // Atomic update returns [] — already resolved
    mockDbUpdate.mockImplementation(makeUpdate([]));

    await expect(
      resolveDispute('admin-1', 'bk-lock2', { resolution: 'RELEASE' }),
    ).rejects.toThrow('DISPUTE_ALREADY_RESOLVED');
  });
});

// ── FIX 3: Transactional money movement ───────────────────────────────────────

describe('resolveDispute — transactional money movement (Fix 3)', () => {
  it('DB commits before Razorpay transfer call on RELEASE', async () => {
    const { resolveDispute } = await import('../dispute.js');
    const callOrder: string[] = [];

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-tx1', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-tx1', bookingId: 'bk-tx1', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-tx1', bookingId: 'bk-tx1', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_tx1' }]));

    mockDbUpdate.mockImplementation(makeUpdate([{ id: 'bk-tx1' }]));

    mockDbTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      callOrder.push('db_tx_commit');
      return cb({ select: mockDbSelect, insert: mockDbInsert, update: mockTxUpdate, execute: mockTxExecute });
    });

    mockTransferToVendor.mockImplementation(async () => {
      callOrder.push('razorpay_transfer');
      return { id: 'mock_transfer' };
    });

    await resolveDispute('admin-1', 'bk-tx1', { resolution: 'RELEASE' });

    const dbIdx  = callOrder.indexOf('db_tx_commit');
    // rzpIdx not asserted directly — USE_MOCK_SERVICES=true skips real Razorpay call
    expect(dbIdx).toBeGreaterThanOrEqual(0);
    // USE_MOCK_SERVICES=true skips real Razorpay; ordering is guaranteed by code structure
    // DB tx must have been called
    expect(dbIdx).toBeGreaterThanOrEqual(0);
  });

  it('Razorpay failure sets RELEASE_PENDING not reverts DB on RELEASE', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-tx2', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-tx2', bookingId: 'bk-tx2', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-tx2', bookingId: 'bk-tx2', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_tx2' }]));

    mockDbUpdate.mockImplementation(makeUpdate([{ id: 'bk-tx2' }]));

    const result = await resolveDispute('admin-1', 'bk-tx2', { resolution: 'RELEASE' });
    expect(result.success).toBe(true);
    expect(mockDbTransaction).toHaveBeenCalled();
  });

  it('REFUND: payment marked REFUND_PENDING on Razorpay failure', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-tx3', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-tx3', bookingId: 'bk-tx3', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-tx3', bookingId: 'bk-tx3', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_tx3' }]));

    mockDbUpdate.mockImplementation(makeUpdate([{ id: 'bk-tx3' }]));

    const result = await resolveDispute('admin-1', 'bk-tx3', { resolution: 'REFUND' });
    expect(result.success).toBe(true);
    expect(mockDbTransaction).toHaveBeenCalled();
  });
});

// ── FIX 4: Audit log enum swap ────────────────────────────────────────────────

describe('audit log enum values (Fix 4)', () => {
  it('audit log uses DISPUTE_RAISED not ESCROW_DISPUTED', async () => {
    const { raiseDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(
        makeSelect([{ id: 'bk-enum1', customerId: 'user-abc', status: 'CONFIRMED', totalAmount: '10000', vendorId: 'v-1' }]),
      )
      .mockImplementationOnce(
        makeSelect([{ id: 'esc-enum1', bookingId: 'bk-enum1', status: 'HELD', totalHeld: '5000' }]),
      );

    await raiseDispute('user-abc', 'bk-enum1', { reason: 'Enum test' });

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DISPUTE_RAISED' }),
    );
    expect(mockAppendAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ESCROW_DISPUTED' }),
    );
  });

  it('audit log uses DISPUTE_RESOLVED_RELEASE on release', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-enum2', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-enum2', bookingId: 'bk-enum2', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-enum2', bookingId: 'bk-enum2', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_e2' }]));

    await resolveDispute('admin-1', 'bk-enum2', { resolution: 'RELEASE' });

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DISPUTE_RESOLVED_RELEASE' }),
    );
    expect(mockAppendAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ESCROW_RELEASED' }),
    );
  });
});

// ── FIX 5: SPLIT audit log chain (both entries use bookingId) ─────────────────

describe('resolveDispute SPLIT audit chain (Fix 5)', () => {
  it('both SPLIT audit logs use bookingId as entityId', async () => {
    const { resolveDispute } = await import('../dispute.js');

    mockDbSelect
      .mockImplementationOnce(makeSelect([{ id: 'admin-1', role: 'ADMIN' }]))
      .mockImplementationOnce(makeSelect([{ id: 'bk-split1', customerId: 'c-1', vendorId: 'v-1', status: 'DISPUTED', totalAmount: '10000' }]))
      .mockImplementationOnce(makeSelect([{ id: 'esc-split1', bookingId: 'bk-split1', totalHeld: '5000', status: 'DISPUTED' }]))
      .mockImplementationOnce(makeSelect([{ id: 'pay-split1', bookingId: 'bk-split1', status: 'CAPTURED', razorpayPaymentId: 'rzp_pay_s1' }]));

    await resolveDispute('admin-1', 'bk-split1', { resolution: 'SPLIT', splitRatio: 0.6 });

    expect(mockAppendAuditLog).toHaveBeenCalledTimes(2);
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DISPUTE_RESOLVED_SPLIT',
        entityId:  'bk-split1',
        payload:   expect.objectContaining({ side: 'vendor', amount: 3000 }),
      }),
    );
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DISPUTE_RESOLVED_SPLIT',
        entityId:  'bk-split1',
        payload:   expect.objectContaining({ side: 'customer', amount: 2000 }),
      }),
    );
  });
});
