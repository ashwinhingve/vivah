/**
 * Referral Programme HTTP tests (Tier 3 Track 1).
 *
 * Covers the three referral endpoints. Better Auth, db and the referralService
 * are mocked — we assert handler behaviour, not the SQL layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockGenerateCodeForUser,
  mockValidateCode,
  mockGetMyReferralActivity,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetSession:           vi.fn(),
  mockGenerateCodeForUser:  vi.fn(),
  mockValidateCode:         vi.fn(),
  mockGetMyReferralActivity:vi.fn(),
  mockDbSelect:             vi.fn(),
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

vi.mock('../services/referralService.js', () => ({
  generateCodeForUser:    mockGenerateCodeForUser,
  validateCode:           mockValidateCode,
  getMyReferralActivity:  mockGetMyReferralActivity,
}));

vi.mock('../lib/db.js', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('../lib/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    USE_MOCK_SERVICES: false,
    DATABASE_URL: 'postgres://x',
  },
}));

import { referralRouter } from '../routes/referral.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/referral', referralRouter);
  return app;
}

const MOCK_USER = {
  id: 'user_referrer1',
  name: 'Riya Sharma',
  email: 'riya@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
  phoneNumber: '+919999999999',
};

const FAKE_CODE = {
  id:        'code_id_1',
  code:      'ABCD1234',
  usesCount: 0,
  isActive:  true,
  createdAt: new Date('2026-05-12T10:00:00Z'),
  expiresAt: null,
};

describe('Referral routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /my-code returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await request(buildApp()).get('/api/v1/referral/my-code');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /my-code lazy-creates the code and returns same code on second call', async () => {
    mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} });
    mockGenerateCodeForUser.mockResolvedValue(FAKE_CODE);

    const first = await request(buildApp()).get('/api/v1/referral/my-code');
    expect(first.status).toBe(200);
    expect(first.body.data.code).toBe('ABCD1234');

    const second = await request(buildApp()).get('/api/v1/referral/my-code');
    expect(second.status).toBe(200);
    expect(second.body.data.code).toBe('ABCD1234');
    expect(mockGenerateCodeForUser).toHaveBeenCalledTimes(2);
    expect(mockGenerateCodeForUser).toHaveBeenCalledWith(MOCK_USER.id);
  });

  it('GET /validate/:code returns valid:true for active code, valid:false for unknown', async () => {
    mockValidateCode.mockResolvedValueOnce(FAKE_CODE);
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ name: 'Riya Sharma' }]),
          }),
        }),
      }),
    });
    const okRes = await request(buildApp()).get('/api/v1/referral/validate/ABCD1234');
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.valid).toBe(true);
    expect(okRes.body.data.referrer_name).toBe('Riya S.');

    mockValidateCode.mockResolvedValueOnce(null);
    const badRes = await request(buildApp()).get('/api/v1/referral/validate/UNKNOWN1');
    expect(badRes.status).toBe(200);
    expect(badRes.body.data.valid).toBe(false);
  });

  it('GET /my-activity returns total_credits:0 and empty referrals for a fresh user', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockGetMyReferralActivity.mockResolvedValueOnce({
      code:          FAKE_CODE,
      totalCredits:  0,
      referrals:     [],
    });
    const res = await request(buildApp()).get('/api/v1/referral/my-activity');
    expect(res.status).toBe(200);
    expect(res.body.data.total_credits).toBe(0);
    expect(res.body.data.referrals).toEqual([]);
    expect(res.body.data.code.code).toBe('ABCD1234');
  });
});
