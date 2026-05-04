/**
 * Smart Shaadi — security & account self-service
 * apps/api/src/auth/securityRouter.ts
 *
 * Mounts at `/api/v1/me`. Powers the /settings/security page in the web app.
 *
 * Endpoints
 *   GET    /sessions                  — list active sessions for the caller
 *   DELETE /sessions/:token           — revoke one session by token
 *   DELETE /sessions                  — revoke every session except the caller's
 *   GET    /security/events           — last 50 audit events for the caller
 *   GET    /security/overview         — summary card data
 *   POST   /account/delete            — soft-delete with 30-day grace window
 *   POST   /account/restore           — undo soft-delete inside the grace window
 *   POST   /phone/change/start        — send OTP to a new phone number
 *   POST   /phone/change/confirm      — verify OTP + switch phoneNumber
 *
 * Two-factor enable / disable / verify-totp / verify-backup are exposed
 * directly by Better Auth's twoFactor plugin under `/api/auth/two-factor/*`
 * and do not need a wrapper.
 */

import { Router, type Request, type Response } from 'express';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import { db } from '../lib/db.js';
import { user, session as sessionTable } from '@smartshaadi/db';
import { redis } from '../lib/redis.js';
import { authenticate } from './middleware.js';
import { auth } from './config.js';
import { ok, err } from '../lib/response.js';
import { recordAuthEvent, listRecentEvents, AuthEventType } from './events.js';
import { recordOtpSent, isPhoneLocked } from './otpLockout.js';

export const securityRouter = Router();

const PHONE_RE = /^\+91[6-9]\d{9}$/;
const PHONE_CHANGE_TTL_S = 10 * 60; // pending-phone OTP good for 10 min
const pendingPhoneKey = (userId: string) => `auth:phone-change:${userId}`;

function ipOf(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() ?? null;
  if (Array.isArray(xff)) return xff[0] ?? null;
  return req.ip ?? null;
}

function uaOf(req: Request): string | null {
  return (req.headers['user-agent'] as string | undefined) ?? null;
}

// ── Sessions ────────────────────────────────────────────────────────────────

securityRouter.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await auth.api.listSessions({ headers: fromNodeHeaders(req.headers) });
    // Identify the caller's own session from the cookie token so the UI can
    // disable the "revoke" button for the current device.
    const currentSession = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const currentToken = currentSession?.session.token ?? null;
    const shaped = list.map((s) => ({
      id:          s.id,
      token:       s.token,
      ipAddress:   s.ipAddress,
      userAgent:   s.userAgent,
      createdAt:   s.createdAt,
      expiresAt:   s.expiresAt,
      updatedAt:   s.updatedAt,
      isCurrent:   s.token === currentToken,
    }));
    ok(res, { sessions: shaped, total: shaped.length });
  } catch (error) {
    console.error('[security] listSessions failed', error);
    err(res, 'SESSIONS_LIST_FAILED', 'Could not load sessions', 500);
  }
});

securityRouter.delete('/sessions/:token', authenticate, async (req: Request, res: Response) => {
  const token = req.params['token'];
  if (!token) { err(res, 'TOKEN_REQUIRED', 'Session token required', 400); return; }
  try {
    // Better Auth's revokeSession revokes whichever row matches the token —
    // it does NOT verify the caller owns it. Confirm ownership first or any
    // authenticated user could revoke another user's sessions by guessing.
    const [target] = await db
      .select({ userId: sessionTable.userId })
      .from(sessionTable)
      .where(eq(sessionTable.token, token))
      .limit(1);

    if (!target) {
      err(res, 'SESSION_NOT_FOUND', 'Session not found', 404);
      return;
    }
    if (target.userId !== req.user!.id) {
      err(res, 'FORBIDDEN', 'Cannot revoke another user\'s session', 403);
      return;
    }

    await auth.api.revokeSession({
      headers: fromNodeHeaders(req.headers),
      body: { token },
    });
    recordAuthEvent({
      userId:    req.user!.id,
      type:      AuthEventType.SESSION_REVOKED,
      ipAddress: ipOf(req),
      userAgent: uaOf(req),
      metadata:  { revokedToken: token },
    });
    ok(res, { revoked: true });
  } catch (error) {
    console.error('[security] revokeSession failed', error);
    err(res, 'SESSION_REVOKE_FAILED', 'Could not revoke session', 500);
  }
});

securityRouter.delete('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    await auth.api.revokeOtherSessions({ headers: fromNodeHeaders(req.headers) });
    recordAuthEvent({
      userId:    req.user!.id,
      type:      AuthEventType.SESSION_REVOKED,
      ipAddress: ipOf(req),
      userAgent: uaOf(req),
      metadata:  { scope: 'others' },
    });
    ok(res, { revoked: true });
  } catch (error) {
    console.error('[security] revokeOtherSessions failed', error);
    err(res, 'SESSIONS_REVOKE_FAILED', 'Could not revoke sessions', 500);
  }
});

// ── Audit log ──────────────────────────────────────────────────────────────

securityRouter.get('/security/events', authenticate, async (req: Request, res: Response) => {
  const limitRaw = req.query['limit'];
  const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 50;
  try {
    const events = await listRecentEvents(req.user!.id, Number.isFinite(limit) ? limit : 50);
    ok(res, { events });
  } catch (error) {
    console.error('[security] listRecentEvents failed', error);
    err(res, 'EVENTS_LIST_FAILED', 'Could not load activity', 500);
  }
});

// ── Overview ───────────────────────────────────────────────────────────────

securityRouter.get('/security/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [u] = await db
      .select({
        id:                  user.id,
        phoneNumber:         user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        email:               user.email,
        emailVerified:       user.emailVerified,
        twoFactorEnabled:    user.twoFactorEnabled,
        deletionRequestedAt: user.deletionRequestedAt,
        createdAt:           user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!u) { err(res, 'USER_NOT_FOUND', 'User not found', 404); return; }

    const sessRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(sessionTable)
      .where(and(eq(sessionTable.userId, userId), sql`${sessionTable.expiresAt} > NOW()`));
    const activeSessionCount = sessRows[0]?.count ?? 0;

    const recent = await listRecentEvents(userId, 1);
    const lastEvent = recent[0] ?? null;

    ok(res, {
      account: {
        phoneNumber:         u.phoneNumber ? `${u.phoneNumber.slice(0, 3)}xxxxxx${u.phoneNumber.slice(-2)}` : null,
        phoneNumberVerified: u.phoneNumberVerified,
        email:               u.email,
        emailVerified:       u.emailVerified,
        memberSince:         u.createdAt,
        deletionRequestedAt: u.deletionRequestedAt,
      },
      twoFactor: { enabled: u.twoFactorEnabled },
      sessions: { active: activeSessionCount ?? 0 },
      lastActivity: lastEvent,
    });
  } catch (error) {
    console.error('[security] overview failed', error);
    err(res, 'OVERVIEW_FAILED', 'Could not load security overview', 500);
  }
});

// ── Account soft-delete ────────────────────────────────────────────────────

securityRouter.post('/account/delete', authenticate, async (req: Request, res: Response) => {
  const { confirm } = req.body as { confirm?: unknown };
  if (confirm !== true) {
    err(res, 'CONFIRMATION_REQUIRED', 'Pass { confirm: true } to delete', 400);
    return;
  }
  try {
    const userId = req.user!.id;
    const now = new Date();
    await db.update(user)
      .set({ deletionRequestedAt: now, status: 'SUSPENDED', updatedAt: now })
      .where(eq(user.id, userId));
    // Revoke every session — the user is signed out everywhere as soon as
    // they request deletion. Cookie cache may keep them logged in for up to
    // 5 minutes (cookieCache.maxAge); we accept that staleness.
    try {
      await auth.api.revokeSessions({ headers: fromNodeHeaders(req.headers) });
    } catch {
      // best-effort
    }
    recordAuthEvent({
      userId,
      type:      AuthEventType.ACCOUNT_DELETION_REQUESTED,
      ipAddress: ipOf(req),
      userAgent: uaOf(req),
      metadata:  { graceUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() },
    });
    ok(res, {
      deletionRequestedAt: now.toISOString(),
      graceWindowDays: 30,
    });
  } catch (error) {
    console.error('[security] account delete failed', error);
    err(res, 'ACCOUNT_DELETE_FAILED', 'Could not delete account', 500);
  }
});

securityRouter.post('/account/restore', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [u] = await db.select({ deletionRequestedAt: user.deletionRequestedAt })
      .from(user).where(eq(user.id, userId)).limit(1);
    if (!u?.deletionRequestedAt) {
      err(res, 'NOT_PENDING_DELETION', 'Account is not pending deletion', 400);
      return;
    }
    await db.update(user)
      .set({ deletionRequestedAt: null, status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(user.id, userId));
    recordAuthEvent({
      userId,
      type:      AuthEventType.ACCOUNT_RESTORED,
      ipAddress: ipOf(req),
      userAgent: uaOf(req),
    });
    ok(res, { restored: true });
  } catch (error) {
    console.error('[security] account restore failed', error);
    err(res, 'ACCOUNT_RESTORE_FAILED', 'Could not restore account', 500);
  }
});

// ── Phone-number change ────────────────────────────────────────────────────

securityRouter.post('/phone/change/start', authenticate, async (req: Request, res: Response) => {
  const { newPhone } = req.body as { newPhone?: unknown };
  if (typeof newPhone !== 'string' || !PHONE_RE.test(newPhone)) {
    err(res, 'INVALID_PHONE', 'Provide a valid +91XXXXXXXXXX number', 422);
    return;
  }
  try {
    if (await isPhoneLocked(newPhone)) {
      err(res, 'PHONE_LOCKED', 'Too many recent OTP attempts on this number — try later', 429);
      return;
    }
    // Reject if the new phone is already attached to another account.
    const [existing] = await db.select({ id: user.id })
      .from(user)
      .where(and(eq(user.phoneNumber, newPhone), isNull(user.deletedAt)))
      .limit(1);
    if (existing && existing.id !== req.user!.id) {
      err(res, 'PHONE_TAKEN', 'This number is already in use', 409);
      return;
    }
    // Generate a 6-digit code, store it in Redis with the pending phone.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttl = PHONE_CHANGE_TTL_S;
    await redis.set(
      pendingPhoneKey(req.user!.id),
      JSON.stringify({ phone: newPhone, code, attempts: 0 }),
      'EX',
      ttl,
    );
    await recordOtpSent(newPhone);
    recordAuthEvent({
      userId:    req.user!.id,
      type:      AuthEventType.OTP_SENT,
      ipAddress: ipOf(req),
      userAgent: uaOf(req),
      metadata:  { purpose: 'PHONE_CHANGE', phone: newPhone },
    });
    // Mock dev mode → return code in response; real mode → MSG91 (TODO).
    // Never log raw OTP to stdout — log aggregation enables account takeover.
    const includeMockCode = process.env['USE_MOCK_SERVICES'] === 'true';
    ok(res, includeMockCode ? { sent: true, expiresIn: ttl, mockCode: code } : { sent: true, expiresIn: ttl });
  } catch (error) {
    console.error('[security] phone change start failed', error);
    err(res, 'PHONE_CHANGE_FAILED', 'Could not start phone change', 500);
  }
});

securityRouter.post('/phone/change/confirm', authenticate, async (req: Request, res: Response) => {
  const { code } = req.body as { code?: unknown };
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    err(res, 'INVALID_CODE', 'Provide the 6-digit code', 422);
    return;
  }
  try {
    const userId = req.user!.id;
    const raw = await redis.get(pendingPhoneKey(userId));
    if (!raw) { err(res, 'NO_PENDING_CHANGE', 'Start a phone change first', 400); return; }
    const pending = JSON.parse(raw) as { phone: string; code: string; attempts: number };
    pending.attempts += 1;
    if (pending.attempts > 5) {
      await redis.del(pendingPhoneKey(userId));
      err(res, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Start over.', 429);
      return;
    }
    if (pending.code !== code) {
      await redis.set(pendingPhoneKey(userId), JSON.stringify(pending), 'EX', PHONE_CHANGE_TTL_S);
      recordAuthEvent({
        userId,
        type:      AuthEventType.OTP_FAILED,
        ipAddress: ipOf(req),
        userAgent: uaOf(req),
        metadata:  { purpose: 'PHONE_CHANGE', remaining: 5 - pending.attempts },
      });
      err(res, 'OTP_INVALID', 'Wrong code', 401, { remaining: 5 - pending.attempts });
      return;
    }
    // Code matches — switch the phone number atomically.
    await db.update(user)
      .set({ phoneNumber: pending.phone, phoneNumberVerified: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
    await redis.del(pendingPhoneKey(userId));
    recordAuthEvent({
      userId,
      type:      AuthEventType.PHONE_CHANGED,
      ipAddress: ipOf(req),
      userAgent: uaOf(req),
      metadata:  { newPhone: pending.phone },
    });
    ok(res, { phoneNumber: pending.phone });
  } catch (error) {
    console.error('[security] phone change confirm failed', error);
    err(res, 'PHONE_CONFIRM_FAILED', 'Could not confirm phone change', 500);
  }
});
