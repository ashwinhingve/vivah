/**
 * Churn-recovery service unit tests (Unit 7.3).
 * All external calls mocked: DB, notification queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockInsert, mockUpdate, mockQueueNotification } = vi.hoisted(() => ({
  mockSelect:            vi.fn(),
  mockInsert:            vi.fn(),
  mockUpdate:            vi.fn(),
  mockQueueNotification: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

vi.mock('@smartshaadi/db', () => ({
  retentionCampaigns: {
    id: {}, userId: {}, status: {}, riskBand: {}, createdAt: {}, sentAt: {}, expiresAt: {},
  },
  profiles: { userId: {}, lastActiveAt: {} },
}));

vi.mock('drizzle-orm', () => ({
  and:     vi.fn((...a: unknown[]) => ({ type: 'and', a })),
  desc:    vi.fn((c: unknown) => ({ type: 'desc', c })),
  eq:      vi.fn((c: unknown, v: unknown) => ({ type: 'eq', c, v })),
  gt:      vi.fn((c: unknown, v: unknown) => ({ type: 'gt', c, v })),
  inArray: vi.fn((c: unknown, v: unknown) => ({ type: 'inArray', c, v })),
  sql:     Object.assign(vi.fn((s: unknown, ...v: unknown[]) => ({ type: 'sql', s, v })), {}),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../infrastructure/redis/queues.js', () => ({
  queueNotification: mockQueueNotification,
}));

import {
  mapAction,
  createRecoveryAttempt,
  markConvertedForActiveUsers,
} from '../service.js';
import type { StayQuotientResponse } from '../../services/stayService.js';

type Row = Record<string, unknown>;

function selectLimitChain(rows: Row[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(rows) };
}
function insertReturningChain(rows: Row[]) {
  return { values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue(rows) };
}
function joinSelectChain(rows: Row[]) {
  return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(rows) };
}
function updateChain() {
  const c = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]), then: (r: (v: unknown) => void) => r(undefined) };
  return c;
}

function quotient(overrides: Partial<StayQuotientResponse> = {}): StayQuotientResponse {
  return {
    user_id: 'user-1',
    churn_probability: 0.82,
    risk_band: 'critical',
    primary_signal: 'high_inactivity',
    recommended_action: 'send_winback_offer',
    feature_contributions: [],
    model_version: 'stay-v1',
    ...overrides,
  };
}

function dbRow(overrides: Row = {}): Row {
  return {
    id: 'camp-1', userId: 'user-1', riskBand: 'critical', churnProbability: 0.82,
    primarySignal: 'high_inactivity', actionType: 'WINBACK_OFFER', channel: null,
    status: 'DRY_RUN', sentAt: null, convertedAt: null,
    expiresAt: new Date(), modelVersion: 'stay-v1',
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('mapAction', () => {
  it('maps winback/offer/incentive → WINBACK_OFFER', () => {
    expect(mapAction('send_winback_offer')).toBe('WINBACK_OFFER');
    expect(mapAction('OFFER_INCENTIVE')).toBe('WINBACK_OFFER');
  });
  it('maps match/reengage → REENGAGE_MATCHES', () => {
    expect(mapAction('reengage_matches')).toBe('REENGAGE_MATCHES');
    expect(mapAction('show pending matches')).toBe('REENGAGE_MATCHES');
  });
  it('falls back to RECOVERY_NUDGE', () => {
    expect(mapAction('something_else')).toBe('RECOVERY_NUDGE');
  });
});

describe('createRecoveryAttempt', () => {
  it('is idempotent — skips when an open attempt already exists', async () => {
    mockSelect.mockReturnValue(selectLimitChain([{ id: 'existing' }]));

    const result = await createRecoveryAttempt(quotient(), false);

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('DRY_RUN posture stores an attempt and messages no one', async () => {
    mockSelect.mockReturnValue(selectLimitChain([]));                 // no open attempt
    mockInsert.mockReturnValue(insertReturningChain([dbRow({ status: 'DRY_RUN' })]));

    const result = await createRecoveryAttempt(quotient(), false /* sendOutreach */);

    expect(result?.status).toBe('DRY_RUN');
    const values = (mockInsert.mock.results[0]!.value.values as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Row;
    expect(values.status).toBe('DRY_RUN');
    expect(values.sentAt).toBeNull();
    expect(mockQueueNotification).not.toHaveBeenCalled();
  });

  it('live posture stores SENT and enqueues the win-back notification', async () => {
    mockSelect.mockReturnValue(selectLimitChain([]));
    mockInsert.mockReturnValue(insertReturningChain([dbRow({ status: 'SENT', sentAt: new Date(), channel: 'inapp' })]));
    mockQueueNotification.mockResolvedValue(undefined);

    const result = await createRecoveryAttempt(quotient(), true /* sendOutreach */);

    expect(result?.status).toBe('SENT');
    expect(mockQueueNotification).toHaveBeenCalledTimes(1);
    expect((mockQueueNotification.mock.calls[0]![0] as { type: string }).type).toBe('CHURN_WINBACK_OFFER');
  });
});

describe('markConvertedForActiveUsers', () => {
  it('converts SENT attempts whose user returned, updating by id', async () => {
    mockSelect.mockReturnValue(joinSelectChain([{ id: 'c1' }, { id: 'c2' }]));
    const upd = updateChain();
    mockUpdate.mockReturnValue(upd);

    const n = await markConvertedForActiveUsers();

    expect(n).toBe(2);
    expect(upd.set).toHaveBeenCalledTimes(1);
    const setArg = upd.set.mock.calls[0]![0] as Row;
    expect(setArg.status).toBe('CONVERTED');
  });

  it('is a no-op when nobody returned', async () => {
    mockSelect.mockReturnValue(joinSelectChain([]));

    const n = await markConvertedForActiveUsers();

    expect(n).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
