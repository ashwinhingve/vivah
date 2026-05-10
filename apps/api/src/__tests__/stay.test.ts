/**
 * Stay Quotient (admin churn risk) API tests.
 *
 * Covers the two admin endpoints:
 *   GET /api/v1/admin/users/:userId/stay-quotient
 *   GET /api/v1/admin/users/at-risk
 *
 * All external dependencies (Better Auth, db, redis, ai-service, Mongo) are
 * mocked so tests run without live infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

const {
  mockGetSession,
  mockExtractStayFeatures,
  mockGetStayQuotient,
  mockRedisGet,
  mockRedisSet,
  mockRedisIncr,
  mockRedisExpire,
  mockDbSelectAtRisk,
  mockLoggerError,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockGetSession:          vi.fn(),
  mockExtractStayFeatures: vi.fn(),
  mockGetStayQuotient:     vi.fn(),
  mockRedisGet:            vi.fn().mockResolvedValue(null),
  mockRedisSet:            vi.fn().mockResolvedValue('OK'),
  mockRedisIncr:           vi.fn().mockResolvedValue(1),
  mockRedisExpire:         vi.fn().mockResolvedValue(1),
  mockDbSelectAtRisk:      vi.fn().mockResolvedValue([]),
  mockLoggerError:         vi.fn(),
  mockLoggerWarn:          vi.fn(),
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

// db.select() chain — at-risk endpoint hits one chained query (.where().orderBy().limit())
vi.mock('../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: mockDbSelectAtRisk,
          })),
        })),
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
  logger: { error: mockLoggerError, warn: mockLoggerWarn, info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/stayFeatures.js', () => ({
  extractStayFeatures: mockExtractStayFeatures,
}));

vi.mock('../services/stayService.js', () => ({
  getStayQuotient: mockGetStayQuotient,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { stayQuotientAdminRouter } from '../admin/stayQuotient.router.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', stayQuotientAdminRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
  user_id: TARGET_USER_ID,
  days_since_last_login: 18,
  messages_sent_last_7d: 0,
  profile_views_received_7d: 1,
  matches_accepted_total: 0,
  profile_completeness: 35,
  days_since_signup: 45,
  has_active_match_request: false,
};

const MOCK_STAY_RESPONSE = {
  user_id: TARGET_USER_ID,
  churn_probability: 0.81,
  risk_band: 'critical' as const,
  primary_signal: 'days_since_last_login',
  recommended_action: "Send re-engagement notification: 'Your matches are waiting'",
  feature_contributions: [
    { factor: 'days_since_last_login', contribution: 0.42 },
    { factor: 'messages_sent_last_7d', contribution: 0.15 },
    { factor: 'profile_views_received_7d', contribution: 0.05 },
    { factor: 'matches_accepted_total', contribution: 0.10 },
    { factor: 'profile_completeness', contribution: 0.06 },
    { factor: 'days_since_signup', contribution: -0.02 },
    { factor: 'has_active_match_request', contribution: 0.0 },
  ],
  model_version: 'stay-v1.0',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/users/:userId/stay-quotient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockExtractStayFeatures.mockResolvedValue(MOCK_FEATURES);
    mockGetStayQuotient.mockResolvedValue(MOCK_STAY_RESPONSE);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/stay-quotient`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for non-ADMIN role', async () => {
    mockGetSession.mockResolvedValueOnce({ user: REGULAR_USER, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/stay-quotient`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with full StayResponse for an authenticated ADMIN', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/stay-quotient`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBe(TARGET_USER_ID);
    expect(res.body.data.risk_band).toBe('critical');
    expect(res.body.data.recommended_action).toContain('re-engagement');
    expect(res.body.data.cached).toBe(false);
    expect(mockExtractStayFeatures).toHaveBeenCalledWith(TARGET_USER_ID);
    expect(mockGetStayQuotient).toHaveBeenCalledOnce();
  });

  it('returns 404 when the userId has no profile', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });

    const notFound = new Error('No profile') as Error & { code: string; status: number };
    notFound.code = 'USER_NOT_FOUND';
    notFound.status = 404;
    mockExtractStayFeatures.mockRejectedValueOnce(notFound);

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/stay-quotient`);

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('USER_NOT_FOUND');
    expect(mockGetStayQuotient).not.toHaveBeenCalled();
  });

  it('serves a cached response without re-calling the AI service', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MOCK_STAY_RESPONSE));

    const res = await request(buildApp())
      .get(`/api/v1/admin/users/${TARGET_USER_ID}/stay-quotient`);

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(true);
    expect(res.body.data.churn_probability).toBe(MOCK_STAY_RESPONSE.churn_probability);
    expect(mockExtractStayFeatures).not.toHaveBeenCalled();
    expect(mockGetStayQuotient).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/admin/users/at-risk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockExtractStayFeatures.mockResolvedValue(MOCK_FEATURES);
  });

  it('returns sorted+filtered list for risk_band=critical', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });

    mockDbSelectAtRisk.mockResolvedValueOnce([
      { id: 'p1', userId: 'u1' },
      { id: 'p2', userId: 'u2' },
      { id: 'p3', userId: 'u3' },
    ]);

    mockGetStayQuotient
      .mockResolvedValueOnce({ ...MOCK_STAY_RESPONSE, user_id: 'u1', churn_probability: 0.55, risk_band: 'high' })
      .mockResolvedValueOnce({ ...MOCK_STAY_RESPONSE, user_id: 'u2', churn_probability: 0.92, risk_band: 'critical' })
      .mockResolvedValueOnce({ ...MOCK_STAY_RESPONSE, user_id: 'u3', churn_probability: 0.78, risk_band: 'critical' });

    const res = await request(buildApp())
      .get('/api/v1/admin/users/at-risk?risk_band=critical&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    // u2 (0.92) before u3 (0.78); u1 filtered out (high band)
    expect(res.body.data.items[0].user_id).toBe('u2');
    expect(res.body.data.items[1].user_id).toBe('u3');
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.risk_band).toBe('critical');
  });
});
