/**
 * Emotional Score API tests
 *
 * Tests the GET /api/v1/ai/emotional-score/:matchId endpoint.
 * All external dependencies are mocked so tests run without live infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

const {
  mockGetSession,
  mockDbSelect,
  mockResolveProfileId,
  mockRedisIncr,
  mockRedisExpire,
  mockRedisGet,
  mockRedisSet,
  mockRedisZadd,
  mockRedisZremrangebyscore,
  mockRedisZrange,
  mockGetEmotionalScore,
} = vi.hoisted(() => ({
  mockGetSession:            vi.fn(),
  mockDbSelect:              vi.fn(),
  mockResolveProfileId:      vi.fn(),
  mockRedisIncr:             vi.fn().mockResolvedValue(1),
  mockRedisExpire:           vi.fn().mockResolvedValue(1),
  mockRedisGet:              vi.fn().mockResolvedValue(null),
  mockRedisSet:              vi.fn().mockResolvedValue('OK'),
  mockRedisZadd:             vi.fn().mockResolvedValue(1),
  mockRedisZremrangebyscore: vi.fn().mockResolvedValue(0),
  mockRedisZrange:           vi.fn().mockResolvedValue([]),
  mockGetEmotionalScore:     vi.fn(),
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
  },
}));

vi.mock('../lib/profile.js', () => ({ resolveProfileId: mockResolveProfileId }));

vi.mock('../lib/redis.js', () => ({
  redis: {
    incr:              mockRedisIncr,
    expire:            mockRedisExpire,
    get:               mockRedisGet,
    set:               mockRedisSet,
    zadd:              mockRedisZadd,
    zremrangebyscore:  mockRedisZremrangebyscore,
    zrange:            mockRedisZrange,
  },
}));

vi.mock('../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: vi.fn(() => ({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })) })),
  },
}));

vi.mock('../infrastructure/mongo/models/Chat.js', () => ({
  Chat: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue(null),
      })),
    })),
  },
}));

vi.mock('../services/aiService.js', () => ({
  getConversationSuggestions: vi.fn(),
  getEmotionalScore:          mockGetEmotionalScore,
}));

// ── Import modules after mocks ────────────────────────────────────────────────

import { aiRouter } from '../routes/ai.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user_abc123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
  phoneNumber: '+919999999999',
};

const MOCK_PROFILE_ID  = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440002';
const MATCH_ID         = '550e8400-e29b-41d4-a716-446655440003';

const MOCK_EMOTIONAL_SCORE = {
  score:        72,
  label:        'WARM' as const,
  trend:        'improving' as const,
  breakdown:    { sentiment: 75, enthusiasm: 70, engagement: 68, curiosity: 77 },
  last_updated: '2026-05-05T00:00:00.000Z',
};

function setupDbMocks(overrides?: {
  callerProfile?: object | null;
  match?: object | null;
}) {
  const callerProfile = overrides?.callerProfile !== undefined
    ? overrides.callerProfile
    : [{ id: MOCK_PROFILE_ID }];
  const match = overrides?.match !== undefined
    ? overrides.match
    : [{
        id:         MATCH_ID,
        senderId:   MOCK_PROFILE_ID,
        receiverId: OTHER_PROFILE_ID,
        status:     'ACCEPTED',
      }];

  mockDbSelect
    .mockResolvedValueOnce(callerProfile ?? [])
    .mockResolvedValueOnce(match ?? []);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/ai/emotional-score/:matchId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisZadd.mockResolvedValue(1);
    mockRedisZremrangebyscore.mockResolvedValue(0);
    mockRedisZrange.mockResolvedValue([]);
    mockResolveProfileId.mockResolvedValue(MOCK_PROFILE_ID);
    mockGetEmotionalScore.mockResolvedValue(MOCK_EMOTIONAL_SCORE);
  });

  // ── Test 1: 401 without session ─────────────────────────────────────────────
  it('returns 401 when no session cookie is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/emotional-score/${MATCH_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Test 2: 403 when user is not a participant ───────────────────────────────
  it('returns 403 when user is not a participant in the match', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupDbMocks({ match: [] }); // match lookup returns empty

    const res = await request(buildApp())
      .get(`/api/v1/ai/emotional-score/${MATCH_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  // ── Test 3: 200 with valid auth ──────────────────────────────────────────────
  it('returns 200 with expected emotional score shape when auth and match are valid', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupDbMocks();

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { messages: [], matchId: MATCH_ID } }),
    } as unknown as Response);

    const res = await request(buildApp())
      .get(`/api/v1/ai/emotional-score/${MATCH_ID}`);

    global.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.score).toBe('number');
    expect(['WARM', 'STEADY', 'COOLING']).toContain(res.body.data.label);
    expect(['improving', 'stable', 'declining']).toContain(res.body.data.trend);
    expect(res.body.data.breakdown).toMatchObject({
      sentiment:  expect.any(Number),
      enthusiasm: expect.any(Number),
      engagement: expect.any(Number),
      curiosity:  expect.any(Number),
    });
    expect(typeof res.body.data.last_updated).toBe('string');
    expect(mockGetEmotionalScore).toHaveBeenCalledOnce();
  });

  // ── Test 4: returns cached value when Redis has fresh entry ─────────────────
  it('returns cached value and does not call ai-service when Redis hit', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupDbMocks();

    // Simulate a warm cache
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MOCK_EMOTIONAL_SCORE));

    const res = await request(buildApp())
      .get(`/api/v1/ai/emotional-score/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBe(MOCK_EMOTIONAL_SCORE.score);
    expect(res.body.data.cached).toBe(true);
    // ai-service must NOT be called — cache served
    expect(mockGetEmotionalScore).not.toHaveBeenCalled();
  });

  // ── Test 5: fallback when ai-service errors ──────────────────────────────────
  it('returns fallback STEADY/stable response when ai-service throws', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupDbMocks();

    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'TimeoutError';
    mockGetEmotionalScore.mockRejectedValueOnce(timeoutErr);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { messages: [], matchId: MATCH_ID } }),
    } as unknown as Response);

    const res = await request(buildApp())
      .get(`/api/v1/ai/emotional-score/${MATCH_ID}`);

    global.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.label).toBe('STEADY');
    expect(res.body.data.trend).toBe('stable');
    expect(res.body.data.score).toBe(50);
    expect(res.body.data.fallback).toBe(true);
  });
});
