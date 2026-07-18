/**
 * Churn-recovery sweep orchestration test (Unit 7.3).
 * Verifies band filtering (only high/critical act) + outreach-flag wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StayQuotientResponse } from '../../services/stayService.js';

const {
  mockSelectCandidates, mockScore, mockCreate, mockConverted, mockExpired,
} = vi.hoisted(() => ({
  mockSelectCandidates: vi.fn(),
  mockScore:            vi.fn(),
  mockCreate:           vi.fn(),
  mockConverted:        vi.fn(),
  mockExpired:          vi.fn(),
}));

vi.mock('../../retention/atRisk.js', () => ({
  selectAtRiskCandidates: mockSelectCandidates,
  scoreCandidates:        mockScore,
}));

vi.mock('../../retention/service.js', () => ({
  createRecoveryAttempt:       mockCreate,
  markConvertedForActiveUsers: mockConverted,
  expireStaleAttempts:         mockExpired,
}));

// DRY_RUN posture — no user messaged. `env` kept for the queues.ts import chain.
vi.mock('../../lib/env.js', () => ({
  shouldSendRetentionOutreach: false,
  env: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test', USE_MOCK_SERVICES: true },
}));
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { runChurnRecoverySweep } from '../churnRecoverySweepJob.js';

function q(risk: StayQuotientResponse['risk_band'], id: string): StayQuotientResponse {
  return {
    user_id: id, churn_probability: 0.5, risk_band: risk, primary_signal: 's',
    recommended_action: 'recover', feature_contributions: [], model_version: 'v1',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConverted.mockResolvedValue(2);
  mockExpired.mockResolvedValue(1);
  mockSelectCandidates.mockResolvedValue([{ id: 'p', userId: 'u' }]);
  mockCreate.mockResolvedValue({ status: 'DRY_RUN' });
});

describe('runChurnRecoverySweep', () => {
  it('only acts on high/critical users and passes the DRY_RUN flag', async () => {
    mockScore.mockResolvedValue([
      q('critical', 'u1'), q('high', 'u2'), q('medium', 'u3'), q('low', 'u4'),
    ]);

    const result = await runChurnRecoverySweep();

    // Only critical + high → 2 attempts; medium/low ignored.
    expect(mockCreate).toHaveBeenCalledTimes(2);
    for (const call of mockCreate.mock.calls) {
      expect(call[1]).toBe(false); // sendOutreach = shouldSendRetentionOutreach
    }
    expect(result.scored).toBe(4);
    expect(result.created).toBe(2);
    expect(result.sent).toBe(0);   // DRY_RUN → nothing sent
    expect(result.converted).toBe(2);
    expect(result.expired).toBe(1);
  });

  it('counts SENT attempts separately when outreach is live', async () => {
    mockScore.mockResolvedValue([q('critical', 'u1')]);
    mockCreate.mockResolvedValue({ status: 'SENT' });

    const result = await runChurnRecoverySweep();

    expect(result.created).toBe(1);
    expect(result.sent).toBe(1);
  });
});
