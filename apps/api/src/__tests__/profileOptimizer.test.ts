/**
 * Profile Optimizer API tests.
 *
 * Covers:
 *   GET /api/v1/ai/profile-optimizer/:userId
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

vi.mock('../services/profileOptimizerFeatures.js', () => ({
  extractProfileOptimizerFeatures: mockExtractFeatures,
}));

vi.mock('../services/profileOptimizerService.js', () => ({
  getProfileOptimizerScore: mockGetScore,
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
  id: 'user_owner_001',
  name: 'Test User',
  email: 'test@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
};

const ADMIN = {
  id: 'user_admin_001',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
};

const OTHER_USER = {
  id: 'user_other_001',
  name: 'Other User',
  email: 'other@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
};

const PROFILE_ID = 'profile-uuid-0001';

const MOCK_FEATURES = {
  profileId: PROFILE_ID,
  photo_count: 4,
  has_primary_photo: true,
  bio_text: 'I love family and career. Enjoy travel and reading.',
  profile_completeness: 85,
};

const MOCK_OPTIMIZER_RESPONSE = {
  user_id: OWNER.id,
  overall_score: 78,
  tier: 'good' as const,
  dimensions: { photo_score: 98, bio_score: 72, completeness_score: 85 },
  field_suggestions: [],
  version: 'profile-optimizer-v1.0',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/ai/profile-optimizer/:userId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockResolveProfileId.mockResolvedValue(PROFILE_ID);
    mockExtractFeatures.mockResolvedValue(MOCK_FEATURES);
    mockGetScore.mockResolvedValue(MOCK_OPTIMIZER_RESPONSE);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/profile-optimizer/${OWNER.id}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when non-owner non-admin tries to view another user', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OTHER_USER, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/ai/profile-optimizer/${OWNER.id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with full optimizer response for the profile owner', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/ai/profile-optimizer/${OWNER.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overall_score).toBe(78);
    expect(res.body.data.tier).toBe('good');
    expect(res.body.data.cached).toBe(false);
    expect(mockExtractFeatures).toHaveBeenCalledWith(OWNER.id, PROFILE_ID);
    expect(mockGetScore).toHaveBeenCalledOnce();
  });

  it('returns 200 for an ADMIN viewing another user', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN, session: {} });

    const res = await request(buildApp())
      .get(`/api/v1/ai/profile-optimizer/${OWNER.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overall_score).toBe(78);
  });

  it('serves a cached response without re-calling the AI service', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MOCK_OPTIMIZER_RESPONSE));

    const res = await request(buildApp())
      .get(`/api/v1/ai/profile-optimizer/${OWNER.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(true);
    expect(res.body.data.overall_score).toBe(78);
    expect(mockExtractFeatures).not.toHaveBeenCalled();
    expect(mockGetScore).not.toHaveBeenCalled();
  });

  it('returns 404 when profile does not exist', async () => {
    mockGetSession.mockResolvedValueOnce({ user: OWNER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/profile-optimizer/${OWNER.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PROFILE_NOT_FOUND');
  });
});
