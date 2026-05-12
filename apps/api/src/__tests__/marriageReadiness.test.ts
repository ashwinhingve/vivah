/**
 * Marriage Readiness API tests.
 *
 * Covers:
 *   GET  /api/v1/ai/marriage-readiness/:userId
 *   PATCH /api/v1/ai/marriage-readiness/:userId/display
 *
 * All external dependencies mocked so tests run without live infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

const {
  mockGetSession,
  mockResolveProfileId,
  mockExtractFeatures,
  mockGetScore,
  mockRedisGet,
  mockRedisSet,
  mockRedisIncr,
  mockRedisExpire,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetSession:       vi.fn(),
  mockResolveProfileId: vi.fn(),
  mockExtractFeatures:  vi.fn(),
  mockGetScore:         vi.fn(),
  mockRedisGet:         vi.fn().mockResolvedValue(null),
  mockRedisSet:         vi.fn().mockResolvedValue('OK'),
  mockRedisIncr:        vi.fn().mockResolvedValue(1),
  mockRedisExpire:      vi.fn().mockResolvedValue(1),
  mockDbSelect:         vi.fn(),
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
        where: vi.fn(() => ({
          limit: mockDbSelect,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
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
  },
}));

vi.mock('../lib/profile.js', () => ({
  resolveProfileId: mockResolveProfileId,
}));

vi.mock('../services/marriageReadinessFeatures.js', () => ({
  extractMarriageReadinessFeatures: mockExtractFeatures,
}));

vi.mock('../services/marriageReadinessService.js', () => ({
  getMarriageReadinessScore: mockGetScore,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { aiRouter } from '../routes/ai.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER = {
  id: 'user_owner_mr_001',
  name: 'Test User',
  email: 'test@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
};

const ADMIN = {
  id: 'user_admin_mr_001',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
};

const OTHER_USER = {
  id: 'user_other_mr_001',
  name: 'Other User',
  email: 'other@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
};

const PROFILE_ID = 'profile-mr-uuid-0001';

const MOCK_FEATURES = {
  avg_msg_count_per_conv: 15.0,
  avg_msg_length: 80,
  profile_completeness: 85,
  age_pref_set: true,
  religion_pref_set: true,
  distance_pref_set: true,
  education_pref_set: false,
  lifestyle_pref_set: false,
};

const MOCK_READINESS_RESPONSE = {
  user_id: OWNER.id,
  readiness_score: 72,
  dimensions: { communication_depth: 65, completeness: 85, goal_clarity: 60 },
  next_actions: ['Set clear partner preferences (age, religion, location, education, lifestyle)'],
  version: 'marriage-readiness-v1.0',
};

const MOCK_PROFILE_ROW = { displayReadinessScore: false };

// ── Tests: GET /marriage-readiness/:userId ─────────────────────────────────────

describe('GET /api/v1/ai/marriage-readiness/:userId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockResolveProfileId.mockResolvedValue(PROFILE_ID);
    mockDbSelect.mockResolvedValue([MOCK_PROFILE_ROW]);
    mockExtractFeatures.mockResolvedValue(MOCK_FEATURES);
    mockGetScore.mockResolvedValue(MOCK_READINESS_RESPONSE);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/marriage-readiness/${OWNER.id}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for non-owner (including ADMIN) — user-controlled per agreement', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/ai/marriage-readiness/${OWNER.id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for other regular user', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OTHER_USER, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/ai/marriage-readiness/${OWNER.id}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with full readiness response for the owner', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/ai/marriage-readiness/${OWNER.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.readiness_score).toBe(72);
    expect(res.body.data.display_allowed).toBe(false);
    expect(res.body.data.cached).toBe(false);
    expect(mockExtractFeatures).toHaveBeenCalledWith(OWNER.id, PROFILE_ID);
    expect(mockGetScore).toHaveBeenCalledOnce();
  });

  it('returns 404 when profile does not exist', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/marriage-readiness/${OWNER.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PROFILE_NOT_FOUND');
  });
});

// ── Tests: PATCH /marriage-readiness/:userId/display ──────────────────────────

describe('PATCH /api/v1/ai/marriage-readiness/:userId/display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockResolveProfileId.mockResolvedValue(PROFILE_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .patch(`/api/v1/ai/marriage-readiness/${OWNER.id}/display`)
      .send({ display: true });

    expect(res.status).toBe(401);
  });

  it('returns 403 when non-owner tries to update display toggle', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OTHER_USER, session: {} });

    const res = await request(buildApp())
      .patch(`/api/v1/ai/marriage-readiness/${OWNER.id}/display`)
      .send({ display: true });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body (missing display field)', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });

    const res = await request(buildApp())
      .patch(`/api/v1/ai/marriage-readiness/${OWNER.id}/display`)
      .send({ enabled: true }); // wrong field name

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 and updates display toggle to true', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });

    const res = await request(buildApp())
      .patch(`/api/v1/ai/marriage-readiness/${OWNER.id}/display`)
      .send({ display: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.display_allowed).toBe(true);
    expect(res.body.data.user_id).toBe(OWNER.id);
  });
});
