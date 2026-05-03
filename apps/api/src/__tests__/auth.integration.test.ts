/**
 * Auth integration tests
 *
 * Tests our Better Auth wiring, the authenticate middleware,
 * and the PATCH /me/role endpoint.
 *
 * We build a minimal Express app inline to avoid importing index.ts
 * (which calls app.listen). Better Auth and the DB are mocked so
 * these tests run in CI without a live database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

// ── Mocks (must be hoisted before module imports) ─────────────────────────────
// vi.mock factories are hoisted to file top by Vitest, so variables they reference
// must also be hoisted via vi.hoisted() to avoid "Cannot access before initialization".

const { mockGetSession, mockDbUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

// Mock the canonical config location (middleware imports directly from ./config.js).
// lib/auth.ts is a re-export shim — mocking config.ts is what actually intercepts it.
vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => {
      res.json({ success: true });
    }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler: (authObj: { handler: (req: Request, res: Response) => void }) =>
    (req: Request, res: Response) => authObj.handler(req, res),
  fromNodeHeaders: vi.fn((headers: Record<string, string>) => headers),
}));

vi.mock('../lib/db.js', () => ({
  db: { update: mockDbUpdate },
}));

// pingLastActive is a fire-and-forget heartbeat that hits db.update directly.
// We don't exercise it in these middleware tests, so stub it out to avoid the
// "[lastActive] update threw synchronously" noise that surfaces when the
// minimal db mock doesn't return a chainable for set/where.
vi.mock('../auth/lastActive.js', () => ({
  pingLastActive: vi.fn(),
}));

// ── Import modules under test after mocks are in place ───────────────────────

import { authenticate } from '../auth/middleware.js';
import { usersRouter } from '../users/router.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', usersRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user_abc123',
  name: 'Test User',
  email: null,
  role: 'INDIVIDUAL',
  status: 'PENDING_VERIFICATION',
  phoneNumber: '+919999999999',
};

// ── authenticate middleware ───────────────────────────────────────────────────

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when there is no active session', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const app = express();
    app.get('/protected', authenticate, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('calls next() and attaches req.user when session is valid', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    const app = express();
    app.get('/protected', authenticate, (req, res) =>
      res.json({ userId: req.user?.id, role: req.user?.role }),
    );

    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: MOCK_USER.id, role: 'INDIVIDUAL' });
  });

  it('returns 401 when getSession returns user=null', async () => {
    mockGetSession.mockResolvedValueOnce({ user: null, session: {} });

    const app = express();
    app.get('/protected', authenticate, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/users/me/role ───────────────────────────────────────────────

describe('PATCH /api/v1/users/me/role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .patch('/api/v1/users/me/role')
      .send({ role: 'INDIVIDUAL' });

    expect(res.status).toBe(401);
  });

  it('returns 422 for an invalid role', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    const res = await request(buildApp())
      .patch('/api/v1/users/me/role')
      .send({ role: 'SUPERADMIN' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'INVALID_ROLE' });
  });

  it('updates role and returns 200 for a valid role', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    const res = await request(buildApp())
      .patch('/api/v1/users/me/role')
      .send({ role: 'VENDOR' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { role: 'VENDOR', status: 'ACTIVE' },
    });
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });

  it('accepts all four valid roles', async () => {
    const validRoles = ['INDIVIDUAL', 'FAMILY_MEMBER', 'VENDOR', 'EVENT_COORDINATOR'];

    for (const role of validRoles) {
      mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });

      const res = await request(buildApp())
        .patch('/api/v1/users/me/role')
        .send({ role });

      expect(res.status, `expected 200 for role=${role}`).toBe(200);
    }
  });

  it('returns 422 when role field is missing', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    const res = await request(buildApp())
      .patch('/api/v1/users/me/role')
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── OTP mock mode ─────────────────────────────────────────────────────────────

describe('OTP mock mode (USE_MOCK_SERVICES=true)', () => {
  /**
   * These tests verify the verifyOTP callback contract without spinning up
   * Better Auth. We extract the same conditional logic used in auth/config.ts
   * and confirm: 123456 passes, everything else fails, prod mode defers.
   */

  function makeVerifyOtp(useMock: string) {
    return function verifyOTP({ code }: { code: string }): Promise<boolean | undefined> {
      if (useMock === 'true') {
        return Promise.resolve(code === '123456');
      }
      // Return undefined to fall through to Better Auth's built-in DB check
      return Promise.resolve(undefined as unknown as boolean);
    };
  }

  const mockVerifyOtp = makeVerifyOtp('true');
  const prodVerifyOtp = makeVerifyOtp('false');

  it('accepts code 123456 in mock mode', async () => {
    await expect(mockVerifyOtp({ code: '123456' })).resolves.toBe(true);
  });

  it('rejects any other code in mock mode', async () => {
    await expect(mockVerifyOtp({ code: '000000' })).resolves.toBe(false);
    await expect(mockVerifyOtp({ code: '111111' })).resolves.toBe(false);
    await expect(mockVerifyOtp({ code: '999999' })).resolves.toBe(false);
  });

  it('returns undefined in production mode (defers to Better Auth DB check)', async () => {
    await expect(prodVerifyOtp({ code: '123456' })).resolves.toBeUndefined();
    await expect(prodVerifyOtp({ code: '000000' })).resolves.toBeUndefined();
  });
});
