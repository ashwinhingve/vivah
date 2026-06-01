import { describe, it, expect } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

import { createAuthLimiter } from '../lib/rateLimit.js';

/**
 * The production `authLimiter` is skipped under NODE_ENV=test / mock mode, so we
 * build a dedicated instance with `skip: () => false` to exercise the 429 path.
 * This proves the existing limiter mechanism (mounted on /api/auth in index.ts)
 * returns 429 once the per-IP request count exceeds the limit.
 */
function buildApp(limit: number) {
  const app = express();
  const limiter = createAuthLimiter({
    skip: () => false,
    limit,
    windowMs: 60_000,
    validate: false, // silence trust-proxy validation in the test harness
  });
  app.use('/api/auth', limiter);
  app.post('/api/auth/phone-number/send-otp', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: null, error: null, meta: {} });
  });
  return app;
}

describe('auth rate limiter', () => {
  it('returns 429 on the request after the limit is exceeded', async () => {
    const limit = 3;
    const app = buildApp(limit);
    const agent = request.agent(app);

    // First `limit` requests succeed.
    for (let i = 0; i < limit; i++) {
      const res = await agent.post('/api/auth/phone-number/send-otp');
      expect(res.status).not.toBe(429);
    }

    // The (limit + 1)th request is rate limited.
    const blocked = await agent.post('/api/auth/phone-number/send-otp');
    expect(blocked.status).toBe(429);
  });
});
