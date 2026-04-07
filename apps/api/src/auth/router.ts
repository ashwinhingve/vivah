import { Router, type Router as ExpressRouter, type Request, type Response } from 'express';
import { RegisterSchema, LoginPhoneSchema, VerifyOtpSchema } from '@vivah/schemas';
import { ok, err } from '../lib/response.js';
import { authenticate } from './middleware.js';
import * as service from './service.js';
import { AuthErrorCode } from '@vivah/types';

export const authRouter: ExpressRouter = Router();

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// ── POST /api/v1/auth/register ────────────────────────────────────────────────

authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422);
    return;
  }

  const { phone, role } = parsed.data;

  try {
    const result = await service.register(phone, role);
    ok(res, { message: `OTP sent to ${result.maskedPhone}` }, 201);
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === AuthErrorCode.USER_EXISTS) {
      err(res, AuthErrorCode.USER_EXISTS, 'An account with this phone number already exists', 409);
    } else {
      console.error('[register]', e);
      err(res, 'INTERNAL_ERROR', 'Failed to register', 500);
    }
  }
});

// ── POST /api/v1/auth/login/phone ─────────────────────────────────────────────

authRouter.post('/login/phone', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginPhoneSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422);
    return;
  }

  const { phone } = parsed.data;

  try {
    await service.loginPhone(phone);
    ok(res, { message: 'OTP sent' });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === AuthErrorCode.USER_NOT_FOUND) {
      err(res, AuthErrorCode.USER_NOT_FOUND, 'No account found with this phone number', 404);
    } else if (name === AuthErrorCode.USER_SUSPENDED) {
      err(res, AuthErrorCode.USER_SUSPENDED, 'This account has been suspended', 403);
    } else if (name === AuthErrorCode.OTP_RATE_LIMITED) {
      err(res, AuthErrorCode.OTP_RATE_LIMITED, 'Please wait 60 seconds before requesting another OTP', 429);
    } else {
      console.error('[login/phone]', e);
      err(res, 'INTERNAL_ERROR', 'Failed to send OTP', 500);
    }
  }
});

// ── POST /api/v1/auth/verify-otp ──────────────────────────────────────────────

authRouter.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const parsed = VerifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422);
    return;
  }

  const { phone, otp, purpose } = parsed.data;

  try {
    const result = await service.verifyOtpAndLogin(phone, otp, purpose);

    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: '/api/v1/auth',
    });

    ok(res, {
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const errorMap: Record<string, [string, number]> = {
      [AuthErrorCode.OTP_EXPIRED]:      [AuthErrorCode.OTP_EXPIRED, 400],
      [AuthErrorCode.OTP_INVALID]:      [AuthErrorCode.OTP_INVALID, 400],
      [AuthErrorCode.OTP_MAX_ATTEMPTS]: [AuthErrorCode.OTP_MAX_ATTEMPTS, 429],
      [AuthErrorCode.USER_NOT_FOUND]:   [AuthErrorCode.USER_NOT_FOUND, 404],
      [AuthErrorCode.USER_SUSPENDED]:   [AuthErrorCode.USER_SUSPENDED, 403],
    };
    const mapped = errorMap[name];
    if (mapped) {
      err(res, mapped[0], name.replace(/_/g, ' ').toLowerCase(), mapped[1]);
    } else {
      console.error('[verify-otp]', e);
      err(res, 'INTERNAL_ERROR', 'OTP verification failed', 500);
    }
  }
});

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────

authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshToken: unknown = req.cookies[REFRESH_COOKIE];

  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    err(res, AuthErrorCode.UNAUTHORIZED, 'Refresh token cookie missing', 401);
    return;
  }

  try {
    const result = await service.refresh(refreshToken);
    ok(res, { accessToken: result.accessToken });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === AuthErrorCode.TOKEN_INVALID) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      err(res, AuthErrorCode.TOKEN_INVALID, 'Refresh token is invalid or expired', 401);
    } else {
      console.error('[refresh]', e);
      err(res, 'INTERNAL_ERROR', 'Token refresh failed', 500);
    }
  }
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────

authRouter.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  const refreshToken: unknown = req.cookies[REFRESH_COOKIE];

  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    try {
      await service.logout(refreshToken);
    } catch {
      // Best-effort — clear cookie regardless
    }
  }

  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  ok(res, { message: 'Logged out successfully' });
});
