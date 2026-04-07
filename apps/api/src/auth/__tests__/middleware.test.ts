import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware.js';
import { signAccess } from '../jwt.js';

// env vars are pre-set by src/vitest.setup.ts

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, cookies: {}, ...overrides } as unknown as Request;
}

function makeRes(): { res: Response } {
  const res = {
    status(_code: number) { return res; },
    json(_data: unknown) { return res; },
  } as unknown as Response;
  return { res };
}

// ── authenticate() ────────────────────────────────────────────────────────────

describe('authenticate()', () => {
  let validToken: string;

  beforeAll(async () => {
    validToken = await signAccess({
      userId: 'user-test',
      role: 'INDIVIDUAL',
      sessionId: 'sess-test',
    });
  });

  it('calls next() and attaches req.user for a valid Bearer token', async () => {
    const req = makeReq({ headers: { authorization: `Bearer ${validToken}` } });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.sub).toBe('user-test');
    expect(req.user?.role).toBe('INDIVIDUAL');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq({ headers: {} });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is malformed', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer not.a.real.token' } });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is not Bearer scheme', async () => {
    const req = makeReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});

// ── authorize() ───────────────────────────────────────────────────────────────

describe('authorize()', () => {
  function makeAuthReq(role: string): Request {
    return {
      headers: {},
      cookies: {},
      user: { sub: 'user-1', role, sessionId: 's1', type: 'access', iat: 0, exp: 9_999_999_999 },
    } as unknown as Request;
  }

  it('calls next() when user role is in the allowed list', () => {
    const req = makeAuthReq('ADMIN');
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authorize(['ADMIN', 'SUPPORT'])(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when user role is NOT in the allowed list', () => {
    const req = makeAuthReq('INDIVIDUAL');
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authorize(['ADMIN'])(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is undefined', () => {
    const req = makeReq({ headers: {} });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authorize(['ADMIN'])(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('passes SUPPORT when allowed roles include SUPPORT', () => {
    const req = makeAuthReq('SUPPORT');
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authorize(['ADMIN', 'SUPPORT'])(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('blocks VENDOR from ADMIN-only route', () => {
    const req = makeAuthReq('VENDOR');
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authorize(['ADMIN'])(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});
