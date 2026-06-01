import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, Router } from 'express';
import request from 'supertest';

import { registerUuidParams, UUID_RE } from '../validateUuidParams.js';

const handler = vi.fn((_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { ok: true }, error: null, meta: {} });
});

function buildApp() {
  const app = express();
  const router = Router();
  registerUuidParams(router, 'id');
  router.get('/:id', handler);
  app.use('/things', router);
  return app;
}

const VALID_UUID = '11111111-2222-4333-8444-555555555555';

describe('registerUuidParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UUID_RE accepts a canonical uuid and rejects junk', () => {
    expect(UUID_RE.test(VALID_UUID)).toBe(true);
    expect(UUID_RE.test('matches')).toBe(false);
    expect(UUID_RE.test('123')).toBe(false);
  });

  it.each(['matches', '123', "'; DROP TABLE bookings;--", 'not-a-uuid'])(
    'returns 400 INVALID_ID for non-uuid "%s" without running the handler',
    async (bad) => {
      const res = await request(buildApp()).get(`/things/${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, error: { code: 'INVALID_ID' } });
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it('passes a valid uuid through to the handler (200)', async () => {
    const res = await request(buildApp()).get(`/things/${VALID_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { ok: true } });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
