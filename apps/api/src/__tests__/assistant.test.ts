/**
 * Matrimony AI Assistant API tests.
 *
 * Covers POST /api/v1/assistant/chat — auth, validation, rate limit, happy
 * path SSE stream. Better Auth, db, redis, profile resolution and the
 * upstream ai-service fetch are all mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockResolveProfileId,
  mockRedisIncr,
  mockRedisExpire,
  mockBuildAssistantContext,
  mockOpenAssistantStream,
} = vi.hoisted(() => ({
  mockGetSession:              vi.fn(),
  mockResolveProfileId:        vi.fn(),
  mockRedisIncr:               vi.fn().mockResolvedValue(1),
  mockRedisExpire:             vi.fn().mockResolvedValue(1),
  mockBuildAssistantContext:   vi.fn(),
  mockOpenAssistantStream:     vi.fn(),
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

vi.mock('../lib/profile.js', () => ({ resolveProfileId: mockResolveProfileId }));

vi.mock('../lib/redis.js', () => ({
  redis: { incr: mockRedisIncr, expire: mockRedisExpire },
}));

vi.mock('../services/assistantContext.js', () => ({
  buildAssistantContext: mockBuildAssistantContext,
}));

vi.mock('../services/assistantService.js', () => ({
  openAssistantStream: mockOpenAssistantStream,
}));

// Force NODE_ENV != 'test' so the rate-limit branch can be exercised on demand.
// The route falls open in test mode otherwise — see checkAssistantRateLimit.
vi.mock('../lib/env.js', () => ({
  env: {
    NODE_ENV:                'production',
    USE_MOCK_SERVICES:        false,
    AI_SERVICE_URL:           'http://localhost:8000',
    AI_SERVICE_INTERNAL_KEY:  'k',
  },
}));

import { assistantRouter } from '../routes/assistant.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/assistant', assistantRouter);
  return app;
}

const MOCK_USER = {
  id: 'user_abc123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
  phoneNumber: '+919999999999',
};
const MOCK_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440001';

const MOCK_CONTEXT = {
  completeness_pct: 60,
  tier:             'STANDARD',
  top_matches:      [],
  pending_requests: 0,
  unread_messages:  0,
  gaps:             [],
  last_active_iso:  null,
};

function makeReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('POST /api/v1/assistant/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockResolveProfileId.mockResolvedValue(MOCK_PROFILE_ID);
    mockBuildAssistantContext.mockResolvedValue(MOCK_CONTEXT);
  });

  it('returns 401 when no session cookie is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({ message: 'hello' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when message is empty', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 when the per-user rate limit is exceeded', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockRedisIncr.mockResolvedValueOnce(61);

    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({ message: 'hello' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('streams text/event-stream chunks on the happy path', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockOpenAssistantStream.mockResolvedValueOnce({
      body: makeReadableStream([
        'data: {"type":"context","context":{}}\n\n',
        'data: {"type":"delta","content":"hi"}\n\n',
        'data: {"type":"done","conversation_id":"c1"}\n\n',
      ]),
    });

    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({ message: 'what should I do next?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('"type":"delta"');
    expect(res.text).toContain('"type":"done"');
    expect(mockBuildAssistantContext).toHaveBeenCalledWith(MOCK_USER.id, MOCK_PROFILE_ID);
  });
});
