/**
 * Reputation Score (admin) API tests.
 *
 * Covers GET /api/v1/admin/users/:userId/reputation.
 *
 * All external dependencies (Better Auth, db, redis, ai-service) are mocked
 * so the suite runs without live infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockExtractReputationFeatures,
  mockGetReputation,
  mockRedisGet,
  mockRedisSet,
  mockRedisIncr,
  mockRedisExpire,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockGetSession:                vi.fn(),
  mockExtractReputationFeatures: vi.fn(),
  mockGetReputation:             vi.fn(),
  mockRedisGet:                  vi.fn().mockResolvedValue(null),
  mockRedisSet:                  vi.fn().mockResolvedValue('OK'),
  mockRedisIncr:                 vi.fn().mockResolvedValue(1),
  mockRedisExpire:               vi.fn().mockResolvedValue(1),
  mockLoggerError:               vi.fn(),
}));

vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => { res.json({ success: true }); }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler: (authObj: { handler: (req: Request, res: Response) => void }) =>
    (req: Request, res: Response) => authObj.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));

vi.mock('../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
      })),
    })),
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get:    mockRedisGet,
    set:    mockRedisSet,
    incr:   mockRedisIncr,
    expire: mockRedisExpire,
    ttl:    vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/reputationFeatures.js', () => ({
  extractReputationFeatures: mockExtractReputationFeatures,
}));

vi.mock('../services/reputationService.js', () => ({
  getReputation: mockGetReputation,
}));

import { reputationAdminRouter } from '../admin/reputation.router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', reputationAdminRouter);
  return app;
}

const ADMIN_USER = {
  id: 'admin_abc123',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
};

const REGULAR_USER = {
  id: 'user_zzz999',
  name: 'Regular User',
  email: 'u@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
};

const TARGET_USER_ID = 'user_target_001';

const MOCK_FEATURES = {
  features: {
    response_rate: 0.75,
    message_response_rate: 0.62,
    avg_response_time_hours_norm: 0.18,
    ghost_count_norm: 0.1,
    consistency_score: 0.7,
  },
  ghostCountRaw: 1,
};

const MOCK_REPUTATION_RESPONSE = {
  user_id: TARGET_USER_ID,
  reputation_score: 82,
  tier: 'gold' as const,
  ghost_count: 1,
  primary_strength: 'high_acceptance',
  primary_concern: null,
  feature_contributions: [
    { factor: 'response_rate',           contribution: 0.32, direction: 'protective' as const },
    { factor: 'message_response_rate',   contribution: 0.21, direction: 'protective' as const },
    { factor: 'avg_response_time_hours', contribution: -0.05, direction: 'concern' as const },
    { factor: 'ghost_count',             contribution: -0.04, direction: 'concern' as const },
    { factor: 'consistency_score',       contribution: 0.18, direction: 'protective' as const },
  ],
  disclaimer: 'Reputation Score is computed from platform behavior signals...',
};

describe('GET /api/v1/admin/users/:userId/reputation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockExtractReputationFeatures.mockResolvedValue(MOCK_FEATURES);
    mockGetReputation.mockResolvedValue(MOCK_REPUTATION_RESPONSE);
  });

  it('returns 401 when no session present', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/reputation`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for non-ADMIN role', async () => {
    mockGetSession.mockResolvedValueOnce({ user: REGULAR_USER, session: {} });
    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/reputation`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with full ReputationResponse for authenticated ADMIN', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/reputation`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBe(TARGET_USER_ID);
    expect(res.body.data.tier).toBe('gold');
    expect(res.body.data.reputation_score).toBe(82);
    expect(res.body.data.cached).toBe(false);
    expect(mockExtractReputationFeatures).toHaveBeenCalledWith(TARGET_USER_ID);
    expect(mockGetReputation).toHaveBeenCalledOnce();
    expect(mockGetReputation).toHaveBeenCalledWith(
      TARGET_USER_ID,
      MOCK_FEATURES.features,
      MOCK_FEATURES.ghostCountRaw,
    );
  });

  it('serves a cached response without re-calling the AI service', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MOCK_REPUTATION_RESPONSE));

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/reputation`);

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(true);
    expect(res.body.data.tier).toBe('gold');
    expect(mockExtractReputationFeatures).not.toHaveBeenCalled();
    expect(mockGetReputation).not.toHaveBeenCalled();
  });

  it('returns 503 when the AI service is unavailable', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    const unavailable = new Error('AI down') as Error & { code: string; status: number };
    unavailable.code = 'AI_SERVICE_UNAVAILABLE';
    unavailable.status = 503;
    mockGetReputation.mockRejectedValueOnce(unavailable);

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/reputation`);

    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe('AI_SERVICE_UNAVAILABLE');
  });
});
