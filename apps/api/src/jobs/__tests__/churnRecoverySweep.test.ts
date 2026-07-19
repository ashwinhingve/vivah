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

  // NOTE: this one runs with the flag still FALSE. It proves the sweep's SENT
  // counter reads the status the service returns — it does NOT prove the flag
  // reaches the service. That is the describe block below.
  it('counts SENT attempts separately when the service reports SENT', async () => {
    mockScore.mockResolvedValue([q('critical', 'u1')]);
    mockCreate.mockResolvedValue({ status: 'SENT' });

    const result = await runChurnRecoverySweep();

    expect(result.created).toBe(1);
    expect(result.sent).toBe(1);
  });
});

// ── Flag ON path (Unit 7.3) ──────────────────────────────────────────────────
//
// Every test above mocks `shouldSendRetentionOutreach: false` at module scope,
// so until now nothing exercised the sweep with outreach live. That gap matters
// because of what happened to Unit 7.2: NRI_MATCHING_LIVE passed type-check and
// a full filter suite while being incapable of working, because the ON path was
// never driven end-to-end and the defect sat in a seam unit tests bypass.
//
// The true end-to-end for retention cannot be run on a dev box at all:
// `shouldSendRetentionOutreach = RETENTION_OUTREACH_LIVE && !USE_MOCK_SERVICES`,
// and the root .env is loaded with `override: true` (lib/env.ts:7), so a shell
// `USE_MOCK_SERVICES=false` is discarded. Flipping it for real also trips the
// env superRefine, which demands live Razorpay/MSG91/R2 credentials that do not
// exist until the launch registrations land.
//
// So this covers the part that IS coverable: that the sweep actually forwards
// the gate to createRecoveryAttempt rather than hardcoding false somewhere.

describe('runChurnRecoverySweep with outreach live', () => {
  it('forwards sendOutreach=true to createRecoveryAttempt for high/critical', async () => {
    vi.resetModules();
    vi.doMock('../../lib/env.js', () => ({
      shouldSendRetentionOutreach: true,
      env: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test', USE_MOCK_SERVICES: false },
    }));

    const { runChurnRecoverySweep: runLive } = await import('../churnRecoverySweepJob.js');

    mockScore.mockResolvedValue([q('critical', 'u1'), q('high', 'u2'), q('low', 'u3')]);
    mockCreate.mockResolvedValue({ status: 'SENT' });

    const result = await runLive();

    expect(mockCreate).toHaveBeenCalledTimes(2);   // low is still ignored
    for (const call of mockCreate.mock.calls) {
      expect(call[1]).toBe(true);                  // the flag reached the service
    }
    expect(result.sent).toBe(2);

    vi.doUnmock('../../lib/env.js');
    vi.resetModules();
  });
});
