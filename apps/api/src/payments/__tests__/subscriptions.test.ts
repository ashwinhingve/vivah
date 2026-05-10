/**
 * Subscription service unit tests — all DB calls and Razorpay are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Static mocks (hoisted before imports) ─────────────────────────────────────

const {
  mockSelect, mockInsert, mockUpdate,
  mockRzpCreate, mockRzpCancel, mockInvalidateTier,
} = vi.hoisted(() => ({
  mockSelect:         vi.fn(),
  mockInsert:         vi.fn(),
  mockUpdate:         vi.fn(),
  mockRzpCreate:      vi.fn(),
  mockRzpCancel:      vi.fn(),
  mockInvalidateTier: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

vi.mock('@smartshaadi/db', () => ({
  plans:               { id: {}, code: {}, active: {}, tier: {}, interval: {}, razorpayPlanId: {} },
  subscriptions:       { id: {}, userId: {}, planId: {}, status: {}, razorpaySubscriptionId: {}, createdAt: {}, gracePeriodEnd: {} },
  subscriptionCharges: { id: {} },
  profiles:            { userId: {}, premiumTier: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc' })),
}));

vi.mock('../../lib/razorpay.js', () => ({
  createSubscription: (...args: unknown[]) => mockRzpCreate(...args),
  cancelSubscription: (...args: unknown[]) => mockRzpCancel(...args),
}));

vi.mock('../../lib/entitlements.js', () => ({
  invalidateTierCache: (...args: unknown[]) => mockInvalidateTier(...args),
}));

vi.mock('../service.js', () => ({
  appendAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, REDIS_URL: 'redis://localhost:6379' },
}));

// ── Query builder helpers ────────────────────────────────────────────────────

type Rows = Record<string, unknown>[];

/**
 * Builds a select chain that supports any combination of:
 *   .from().where().limit()
 *   .from().innerJoin().where().orderBy().limit()
 *   .from().where()                                    (await directly)
 */
function selectChain(rows: Rows) {
  const chain: Record<string, unknown> = {};
  chain.from      = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where     = vi.fn().mockReturnValue(chain);
  chain.orderBy   = vi.fn().mockReturnValue(chain);
  chain.limit     = vi.fn().mockResolvedValue(rows);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return chain;
}

function insertChain(row: Record<string, unknown>) {
  return {
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
}

function updateChain() {
  const chain: Record<string, unknown> = {};
  chain.set   = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

// ── Service under test (imported AFTER mocks) ─────────────────────────────────

import {
  listPlans,
  startSubscription,
  cancelSubscription,
  expireGracePeriods,
} from '../subscriptions.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const PLAN_ID = 'plan-uuid-standard-m';
const SUB_ID  = 'sub-uuid-1';

const standardPlan = {
  id:             PLAN_ID,
  code:           'STANDARD_M',
  name:           'Standard Monthly',
  tier:           'STANDARD',
  interval:       'MONTHLY',
  amount:         '999.00',
  features:       ['Unlimited matches'],
  razorpayPlanId: 'mock_plan_standard_monthly',
  active:         true,
};

const planNoRzp = { ...standardPlan, razorpayPlanId: null };

const inactivePlan = { ...standardPlan, active: false };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('listPlans', () => {
  it('returns active plans mapped to API shape', async () => {
    mockSelect.mockReturnValueOnce(selectChain([standardPlan]));
    const result = await listPlans();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id:       PLAN_ID,
      code:     'STANDARD_M',
      tier:     'STANDARD',
      interval: 'MONTHLY',
      amount:   999,
    });
  });
});

describe('startSubscription', () => {
  it('happy path: creates row, calls razorpay, returns shortUrl', async () => {
    // 1st select: plan lookup
    mockSelect.mockReturnValueOnce(selectChain([standardPlan]));
    // 2nd select: getActiveSubscription → no existing
    mockSelect.mockReturnValueOnce(selectChain([]));

    mockRzpCreate.mockResolvedValueOnce({
      id:        'sub_mock_xxx',
      status:    'created',
      short_url: 'https://rzp.io/i/mock_xxx',
    });

    const insertedRow = {
      id:                     SUB_ID,
      razorpaySubscriptionId: 'sub_mock_xxx',
      shortUrl:               'https://rzp.io/i/mock_xxx',
      status:                 'CREATED',
    };
    mockInsert.mockReturnValueOnce(insertChain(insertedRow));

    const result = await startSubscription(USER_ID, 'STANDARD_M');
    expect(result).toEqual({
      subscriptionId:         SUB_ID,
      razorpaySubscriptionId: 'sub_mock_xxx',
      shortUrl:               'https://rzp.io/i/mock_xxx',
      status:                 'CREATED',
    });
    expect(mockRzpCreate).toHaveBeenCalledTimes(1);
    expect(mockRzpCreate).toHaveBeenCalledWith(expect.objectContaining({
      planId:     'mock_plan_standard_monthly',
      totalCount: 12,
      notes:      { userId: USER_ID, planCode: 'STANDARD_M' },
    }));
  });

  it('throws 404 when plan not found', async () => {
    mockSelect.mockReturnValueOnce(selectChain([]));
    await expect(startSubscription(USER_ID, 'GHOST'))
      .rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('throws 410 when plan inactive', async () => {
    mockSelect.mockReturnValueOnce(selectChain([inactivePlan]));
    await expect(startSubscription(USER_ID, 'STANDARD_M'))
      .rejects.toMatchObject({ code: 'INACTIVE', status: 410 });
  });

  it('throws 503 when razorpayPlanId is null', async () => {
    mockSelect.mockReturnValueOnce(selectChain([planNoRzp]));
    await expect(startSubscription(USER_ID, 'STANDARD_M'))
      .rejects.toMatchObject({ code: 'NOT_READY', status: 503 });
    expect(mockRzpCreate).not.toHaveBeenCalled();
  });

  it('throws 409 ALREADY_SUBSCRIBED when active sub exists', async () => {
    mockSelect.mockReturnValueOnce(selectChain([standardPlan]));
    mockSelect.mockReturnValueOnce(selectChain([{
      id:                 SUB_ID,
      status:             'ACTIVE',
      planCode:           'STANDARD_M',
      tier:               'STANDARD',
      currentPeriodStart: null,
      currentPeriodEnd:   null,
      cancelAtPeriodEnd:  false,
    }]));
    await expect(startSubscription(USER_ID, 'STANDARD_M'))
      .rejects.toMatchObject({ code: 'ALREADY_SUBSCRIBED', status: 409 });
    expect(mockRzpCreate).not.toHaveBeenCalled();
  });
});

describe('cancelSubscription', () => {
  const subRow = {
    id:                     SUB_ID,
    userId:                 USER_ID,
    razorpaySubscriptionId: 'sub_mock_xxx',
    status:                 'ACTIVE',
  };

  it('atCycleEnd=true → updates cancelAtPeriodEnd, does NOT invalidate tier', async () => {
    mockSelect.mockReturnValueOnce(selectChain([subRow]));
    mockRzpCancel.mockResolvedValueOnce({ status: 'cancelled' });
    mockUpdate.mockReturnValueOnce(updateChain());

    await cancelSubscription(USER_ID, SUB_ID, true);

    expect(mockRzpCancel).toHaveBeenCalledWith('sub_mock_xxx', true);
    expect(mockInvalidateTier).not.toHaveBeenCalled();
  });

  it('atCycleEnd=false → CANCELLED status + invalidates tier + downgrades profile', async () => {
    mockSelect.mockReturnValueOnce(selectChain([subRow]));
    mockRzpCancel.mockResolvedValueOnce({ status: 'cancelled' });
    mockUpdate.mockReturnValueOnce(updateChain()); // subscription status update
    mockUpdate.mockReturnValueOnce(updateChain()); // profile downgrade

    await cancelSubscription(USER_ID, SUB_ID, false);

    expect(mockRzpCancel).toHaveBeenCalledWith('sub_mock_xxx', false);
    expect(mockInvalidateTier).toHaveBeenCalledWith(USER_ID);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('throws 403 when subscription belongs to different user', async () => {
    mockSelect.mockReturnValueOnce(selectChain([{ ...subRow, userId: 'other-user' }]));
    await expect(cancelSubscription(USER_ID, SUB_ID, true))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(mockRzpCancel).not.toHaveBeenCalled();
  });
});

describe('expireGracePeriods', () => {
  it('moves expired HALTED rows to EXPIRED + invalidates tier per user', async () => {
    const past = new Date(Date.now() - 1000);
    // 1st select: list of HALTED rows
    mockSelect.mockReturnValueOnce(selectChain([
      { id: 'sub-a', userId: 'user-a' },
      { id: 'sub-b', userId: 'user-b' },
    ]));
    // 2nd + 3rd selects: per-row gracePeriodEnd lookups (both expired)
    mockSelect.mockReturnValueOnce(selectChain([{ id: 'sub-a', gracePeriodEnd: past }]));
    mockSelect.mockReturnValueOnce(selectChain([{ id: 'sub-b', gracePeriodEnd: past }]));

    mockUpdate.mockReturnValue(updateChain());

    const result = await expireGracePeriods();
    expect(result.expired).toBe(2);
    expect(mockInvalidateTier).toHaveBeenCalledTimes(2);
    expect(mockInvalidateTier).toHaveBeenCalledWith('user-a');
    expect(mockInvalidateTier).toHaveBeenCalledWith('user-b');
  });

  it('skips rows whose gracePeriodEnd is still in future', async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000);
    mockSelect.mockReturnValueOnce(selectChain([{ id: 'sub-a', userId: 'user-a' }]));
    mockSelect.mockReturnValueOnce(selectChain([{ id: 'sub-a', gracePeriodEnd: future }]));

    mockUpdate.mockReturnValue(updateChain());

    const result = await expireGracePeriods();
    expect(result.expired).toBe(0);
    expect(mockInvalidateTier).not.toHaveBeenCalled();
  });
});
