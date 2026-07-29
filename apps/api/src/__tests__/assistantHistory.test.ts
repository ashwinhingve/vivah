/**
 * Assistant conversation-history tests.
 *
 * Routes: GET/DELETE /api/v1/assistant/conversations* — auth, validation,
 * ownership 404s, envelope shape — with the service layer mocked.
 * Service: title/preview derivation + ownership filters — with the Mongoose
 * model mocked. Also covers the chat route's page_context validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockResolveProfileId,
  mockBuildAssistantContext,
  mockOpenAssistantStream,
  mockList,
  mockGet,
  mockDelete,
} = vi.hoisted(() => ({
  mockGetSession:            vi.fn(),
  mockResolveProfileId:      vi.fn(),
  mockBuildAssistantContext: vi.fn(),
  mockOpenAssistantStream:   vi.fn(),
  mockList:                  vi.fn(),
  mockGet:                   vi.fn(),
  mockDelete:                vi.fn(),
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
  redis: { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) },
}));
vi.mock('../services/assistantContext.js', () => ({
  buildAssistantContext: mockBuildAssistantContext,
}));
vi.mock('../services/assistantService.js', () => ({
  openAssistantStream: mockOpenAssistantStream,
}));
vi.mock('../services/assistantHistory.js', () => ({
  listAssistantConversations:  mockList,
  getAssistantConversation:    mockGet,
  deleteAssistantConversation: mockDelete,
}));
vi.mock('../lib/env.js', () => ({
  env: {
    NODE_ENV:                'test',
    USE_MOCK_SERVICES:        true,
    AI_SERVICE_URL:           'http://localhost:8000',
    AI_SERVICE_INTERNAL_KEY:  'k',
    MONGODB_DB:               'smartshaadiDB',
  },
  shouldUseMockMongo: true,
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
const CONVO_ID = '550e8400-e29b-41d4-a716-446655440042';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} });
  mockResolveProfileId.mockResolvedValue('550e8400-e29b-41d4-a716-446655440001');
  mockBuildAssistantContext.mockResolvedValue({
    completeness_pct: 60, tier: 'STANDARD', top_matches: [],
    pending_requests: 0, unread_messages: 0, gaps: [], last_active_iso: null,
  });
});

describe('GET /api/v1/assistant/conversations', () => {
  it('returns the user conversation summaries', async () => {
    mockList.mockResolvedValueOnce([
      { id: CONVO_ID, title: 'How do I upgrade?', preview: 'You can…', message_count: 4, updated_at: '2026-07-29T10:00:00.000Z' },
    ]);

    const res = await request(buildApp()).get('/api/v1/assistant/conversations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversations).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith(MOCK_USER.id);
  });

  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await request(buildApp()).get('/api/v1/assistant/conversations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/assistant/conversations/:id', () => {
  it('returns the conversation detail', async () => {
    mockGet.mockResolvedValueOnce({
      id: CONVO_ID, title: 'Hi', messages: [], created_at: 'x', updated_at: 'y',
    });

    const res = await request(buildApp()).get(`/api/v1/assistant/conversations/${CONVO_ID}`);

    expect(res.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith(MOCK_USER.id, CONVO_ID);
  });

  it('rejects a non-uuid id with 400', async () => {
    const res = await request(buildApp()).get('/api/v1/assistant/conversations/not-a-uuid');
    expect(res.status).toBe(400);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("404s when the conversation is missing or another user's", async () => {
    mockGet.mockResolvedValueOnce(null);
    const res = await request(buildApp()).get(`/api/v1/assistant/conversations/${CONVO_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/assistant/conversations/:id', () => {
  it('deletes an owned conversation', async () => {
    mockDelete.mockResolvedValueOnce(true);
    const res = await request(buildApp()).delete(`/api/v1/assistant/conversations/${CONVO_ID}`);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(MOCK_USER.id, CONVO_ID);
  });

  it("404s when deleting a missing/another user's conversation", async () => {
    mockDelete.mockResolvedValueOnce(false);
    const res = await request(buildApp()).delete(`/api/v1/assistant/conversations/${CONVO_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/assistant/chat — page_context', () => {
  function stream(): { body: ReadableStream<Uint8Array> } {
    const encoder = new TextEncoder();
    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"done","conversation_id":"c1"}\n\n'));
          controller.close();
        },
      }),
    };
  }

  it('forwards a valid page_context to the ai-service payload', async () => {
    mockOpenAssistantStream.mockResolvedValueOnce(stream());

    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({
        message: 'is this vendor verified?',
        page_context: {
          pathname: '/vendors/v1',
          entity_type: 'vendor',
          entity_id: 'v1',
          junk_field: 'stripped',
        },
      });

    expect(res.status).toBe(200);
    const payload = mockOpenAssistantStream.mock.calls[0]?.[0] as {
      page_context: Record<string, unknown>;
    };
    expect(payload.page_context).toEqual({
      pathname: '/vendors/v1',
      entity_type: 'vendor',
      entity_id: 'v1',
    });
  });

  it('rejects an oversized pathname with 400', async () => {
    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({
        message: 'hello',
        page_context: { pathname: 'x'.repeat(301) },
      });
    expect(res.status).toBe(400);
    expect(mockOpenAssistantStream).not.toHaveBeenCalled();
  });

  it('rejects an unknown entity_type with 400', async () => {
    const res = await request(buildApp())
      .post('/api/v1/assistant/chat')
      .send({
        message: 'hello',
        page_context: { pathname: '/x', entity_type: 'admin_panel' },
      });
    expect(res.status).toBe(400);
  });
});
