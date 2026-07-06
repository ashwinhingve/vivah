/**
 * Assistant tool bridge tests — POST /internal/assistant/tool.
 *
 * Covers the security-critical bridge behavior: internal-key gate, unknown-tool
 * rejection, and the defense-in-depth authz check that re-derives profileId and
 * refuses a mismatch (so a compromised/buggy ai-service can never read another
 * user's data). Redis, profile resolution and the tool registry are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockResolveProfileId,
  mockRedisGet,
  mockRedisSetex,
  mockRedisIncr,
  mockRedisExpire,
  mockGetMyProfile,
} = vi.hoisted(() => ({
  mockResolveProfileId: vi.fn(),
  mockRedisGet:         vi.fn(),
  mockRedisSetex:       vi.fn(),
  mockRedisIncr:        vi.fn().mockResolvedValue(1),
  mockRedisExpire:      vi.fn().mockResolvedValue(1),
  mockGetMyProfile:     vi.fn(),
}));

vi.mock('../lib/env.js', () => ({
  env: {
    NODE_ENV:                'test',
    USE_MOCK_SERVICES:        false,
    AI_SERVICE_INTERNAL_KEY:  'secret-key',
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get:    mockRedisGet,
    setex:  mockRedisSetex,
    incr:   mockRedisIncr,
    expire: mockRedisExpire,
  },
}));

vi.mock('../lib/profile.js', () => ({ resolveProfileId: mockResolveProfileId }));

vi.mock('../services/assistantTools.js', () => ({
  ASSISTANT_TOOLS: { get_my_profile: mockGetMyProfile },
  isKnownTool: (name: string) => name === 'get_my_profile',
}));

import { internalRouter } from '../routes/internal.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/internal', internalRouter);
  return app;
}

const USER_ID = 'user_abc123';
const PROFILE_ID = '550e8400-e29b-41d4-a716-446655440001';

function post(body: unknown, key: string | null = 'secret-key') {
  const req = request(buildApp()).post('/internal/assistant/tool');
  if (key !== null) req.set('X-Internal-Key', key);
  return req.send(body as object);
}

describe('POST /internal/assistant/tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveProfileId.mockResolvedValue(PROFILE_ID);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue('OK');
    mockGetMyProfile.mockResolvedValue({ completeness_pct: 78 });
  });

  it('rejects a missing/invalid internal key with 403', async () => {
    const res = await post(
      { userId: USER_ID, profileId: PROFILE_ID, toolName: 'get_my_profile', args: {} },
      'wrong-key',
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it('rejects an unknown tool with 400', async () => {
    const res = await post({ userId: USER_ID, profileId: PROFILE_ID, toolName: 'rm_rf', args: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOOL_NOT_FOUND');
  });

  it('rejects a profileId mismatch with 403 (cross-user isolation)', async () => {
    mockResolveProfileId.mockResolvedValueOnce('a-different-profile-id');
    const res = await post({
      userId: USER_ID,
      profileId: PROFILE_ID, // caller CLAIMS this, but server derives another
      toolName: 'get_my_profile',
      args: {},
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it('returns 404 when the user has no profile', async () => {
    mockResolveProfileId.mockResolvedValueOnce(null);
    const res = await post({ userId: USER_ID, profileId: PROFILE_ID, toolName: 'get_my_profile', args: {} });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('dispatches the tool with the SERVER-derived profileId and returns data', async () => {
    const res = await post({ userId: USER_ID, profileId: PROFILE_ID, toolName: 'get_my_profile', args: {} });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ completeness_pct: 78 });
    expect(mockGetMyProfile).toHaveBeenCalledTimes(1);
    const [, ctx] = mockGetMyProfile.mock.calls[0]!;
    expect(ctx).toEqual({ userId: USER_ID, profileId: PROFILE_ID });
  });

  it('serves a cache hit without re-running the tool', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ completeness_pct: 99 }));
    const res = await post({ userId: USER_ID, profileId: PROFILE_ID, toolName: 'get_my_profile', args: {} });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ completeness_pct: 99 });
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });
});
