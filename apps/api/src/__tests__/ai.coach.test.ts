/**
 * Conversation Coach API tests
 *
 * Tests the POST /api/v1/ai/coach/suggest endpoint and the internal
 * GET /internal/chat/:matchId/messages endpoint.
 *
 * All external dependencies (Better Auth, DB, MongoDB, Redis, AI service fetch)
 * are mocked so these tests run in CI without live infrastructure.
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
  mockGetConversationSuggestions,
} = vi.hoisted(() => ({
  mockGetSession:               vi.fn(),
  mockDbSelect:                 vi.fn(),
  mockResolveProfileId:         vi.fn(),
  mockRedisIncr:                vi.fn().mockResolvedValue(1),
  mockRedisExpire:              vi.fn().mockResolvedValue(1),
  mockGetConversationSuggestions: vi.fn(),
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

// DB mock — returns a chainable .from().where().limit() that resolves to mockDbSelect()
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
    incr:   mockRedisIncr,
    expire: mockRedisExpire,
  },
}));

// Mock ProfileContent (MongoDB) — no-op in test env (USE_MOCK_SERVICES=true skips it anyway)
vi.mock('../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: vi.fn(() => ({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })) })),
  },
}));

// Mock the Chat model (used by internal router)
vi.mock('../infrastructure/mongo/models/Chat.js', () => ({
  Chat: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue(null),
      })),
    })),
  },
}));

// ── Mock the AI service client ────────────────────────────────────────────────

vi.mock('../services/aiService.js', () => ({
  getConversationSuggestions: mockGetConversationSuggestions,
}));

// ── Import modules after mocks ─────────────────────────────────────────────────

import { aiRouter } from '../routes/ai.js';
import { internalRouter } from '../routes/internal.js';

// ── Test app factories ────────────────────────────────────────────────────────

function buildAiApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  return app;
}

function buildInternalApp() {
  const app = express();
  app.use(express.json());
  app.use('/internal', internalRouter);
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

const MOCK_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440002';
const MATCH_ID = '550e8400-e29b-41d4-a716-446655440003';
const INTERNAL_KEY = 'internal-key-change-in-prod'; // matches env default in test

const MOCK_SUGGESTIONS = {
  suggestions: [
    { text: 'Tell me about your favourite festival?', reason: 'Shared interest in culture', tone: 'warm' as const },
    { text: 'What kind of music do you enjoy?', reason: 'Common hobby area', tone: 'curious' as const },
  ],
  state: 'STARTING' as const,
  cached: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Set up DB mock sequence: [callerProfile], [match], [otherProfile] */
function setupDbMocks(overrides?: {
  callerProfile?: object | null;
  match?: object | null;
  otherProfile?: object | null;
}) {
  const callerProfile = overrides?.callerProfile !== undefined
    ? overrides.callerProfile
    : [{ id: MOCK_PROFILE_ID }];
  const match = overrides?.match !== undefined
    ? overrides.match
    : [{
        id: MATCH_ID,
        senderId: MOCK_PROFILE_ID,
        receiverId: OTHER_PROFILE_ID,
        status: 'ACCEPTED',
      }];
  const otherProfile = overrides?.otherProfile !== undefined
    ? overrides.otherProfile
    : [{ id: OTHER_PROFILE_ID, userId: 'user_other123' }];

  mockDbSelect
    .mockResolvedValueOnce(callerProfile ?? [])
    .mockResolvedValueOnce(match ?? [])
    .mockResolvedValueOnce(otherProfile ?? []);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/ai/coach/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows (count=1)
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    // Default: profile resolves
    mockResolveProfileId.mockResolvedValue(MOCK_PROFILE_ID);
    // Default: AI service returns suggestions
    mockGetConversationSuggestions.mockResolvedValue(MOCK_SUGGESTIONS);
  });

  // ── Test 1: 401 without session ─────────────────────────────────────────────
  it('returns 401 when no session cookie is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildAiApp())
      .post('/api/v1/ai/coach/suggest')
      .send({ matchId: MATCH_ID });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Test 2: 403 when user is not a participant ───────────────────────────────
  it('returns 403 when user is not a participant in the match', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    // callerProfile found, but match lookup returns empty (not participant / not accepted)
    setupDbMocks({ match: [] });

    const res = await request(buildAiApp())
      .post('/api/v1/ai/coach/suggest')
      .send({ matchId: MATCH_ID });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  // ── Test 3: 200 with valid auth + valid match ────────────────────────────────
  it('returns 200 with suggestions when auth and match are valid', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupDbMocks();

    // Global fetch is used internally to call /internal/chat messages.
    // In test mode (USE_MOCK_SERVICES=true) the internal route returns canned data,
    // but since we mount separate apps, we stub global.fetch to return empty messages.
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { messages: [], matchId: MATCH_ID } }),
    } as unknown as Response);

    const res = await request(buildAiApp())
      .post('/api/v1/ai/coach/suggest')
      .send({ matchId: MATCH_ID });

    global.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.suggestions)).toBe(true);
    expect(res.body.data.suggestions.length).toBeGreaterThanOrEqual(0);
    expect(mockGetConversationSuggestions).toHaveBeenCalledOnce();
  });

  // ── Test 4: fallback when AI service throws (timeout / 503) ─────────────────
  it('returns fallback response (not 500) when AI service is unavailable', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupDbMocks();

    // Simulate AI service timeout
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    mockGetConversationSuggestions.mockRejectedValueOnce(timeoutError);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { messages: [], matchId: MATCH_ID } }),
    } as unknown as Response);

    const res = await request(buildAiApp())
      .post('/api/v1/ai/coach/suggest')
      .send({ matchId: MATCH_ID });

    global.fetch = originalFetch;

    // Must NOT be 500 — graceful fallback
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fallback).toBe(true);
    expect(res.body.data.suggestions).toEqual([]);
    expect(res.body.data.state).toBe('STARTING');
  });
});

// ── Internal endpoint tests ───────────────────────────────────────────────────

describe('GET /internal/chat/:matchId/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when X-Internal-Key is missing', async () => {
    const res = await request(buildInternalApp())
      .get(`/internal/chat/${MATCH_ID}/messages`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('returns 403 when X-Internal-Key is wrong', async () => {
    const res = await request(buildInternalApp())
      .get(`/internal/chat/${MATCH_ID}/messages`)
      .set('X-Internal-Key', 'wrong-key');

    expect(res.status).toBe(403);
  });

  it('returns 200 with canned mock messages in mock mode', async () => {
    // USE_MOCK_SERVICES=true from vitest.setup.ts
    const res = await request(buildInternalApp())
      .get(`/internal/chat/${MATCH_ID}/messages?limit=5`)
      .set('X-Internal-Key', INTERNAL_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.messages)).toBe(true);
    expect(res.body.data.matchId).toBe(MATCH_ID);
    // Messages have correct shape
    for (const msg of res.body.data.messages as Array<{ sender: string; text: string; timestamp: string }>) {
      expect(['A', 'B']).toContain(msg.sender);
      expect(typeof msg.text).toBe('string');
      expect(typeof msg.timestamp).toBe('string');
    }
  });
});
