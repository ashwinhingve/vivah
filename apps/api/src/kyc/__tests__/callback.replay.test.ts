/**
 * DigiLocker OAuth callback — inbound integration replay.
 *
 * DigiLocker is NOT an HMAC webhook: it's a GET redirect carrying a short-lived
 * auth `code`, protected by the user's session. This test replays the canonical
 * callback fixture against the real route and asserts it routes the code to the
 * KYC verification service (mock mode returns a synthetic result). It documents
 * the inbound integration point so the real-DigiLocker swap has a safety net.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { mockComplete } = vi.hoisted(() => ({ mockComplete: vi.fn() }));

vi.mock('../../auth/middleware.js', () => ({
  authenticate: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: 'user-1', role: 'INDIVIDUAL', status: 'ACTIVE', name: 'Test User' };
    next();
  }),
  authorize: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../service.js', () => ({ completeAadhaarVerification: mockComplete }));

const FIX = path.join(process.cwd(), 'src/__fixtures__/webhooks');
const fixture = JSON.parse(
  readFileSync(path.join(FIX, 'digilocker-callback.json'), 'utf8'),
) as { query: { code: string; state: string } };

async function buildApp() {
  const { kycRouter } = await import('../router.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/kyc', kycRouter);
  return app;
}

describe('DigiLocker callback replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComplete.mockResolvedValue({ duplicateFlag: false });
  });

  it('routes a valid callback code to KYC verification (200)', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/v1/kyc/callback')
      .query({ code: fixture.query.code, state: fixture.query.state });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockComplete).toHaveBeenCalledWith(
      'user-1', fixture.query.code, expect.anything(), expect.anything(),
    );
  });

  it('rejects a callback missing the code with 400', async () => {
    const app = await buildApp();
    const res = await request(app).get('/api/v1/kyc/callback');

    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
