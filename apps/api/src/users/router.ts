import { Router, type Request, type Response } from 'express';
import { eq, desc, and, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  user,
  notifications,
  notificationPreferences,
  deviceTokens,
} from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import type { UserRole } from '@smartshaadi/types';
import { NotificationPrefsSchema, RegisterDeviceSchema, NotificationListQuerySchema } from '@smartshaadi/schemas';
import { getEntitlements, getProfileTier } from '../lib/entitlements.js';
import { peekInterestQuota } from '../lib/quotas.js';

const VALID_ROLES: UserRole[] = ['INDIVIDUAL', 'FAMILY_MEMBER', 'VENDOR', 'EVENT_COORDINATOR'];

export const usersRouter = Router();

/**
 * PATCH /api/v1/users/me/role
 * Sets the authenticated user's role and marks their account ACTIVE.
 * Called once after first OTP verification from /register/role.
 */
usersRouter.patch('/me/role', authenticate, async (req: Request, res: Response) => {
  const { role } = req.body as { role?: unknown };

  if (typeof role !== 'string' || !VALID_ROLES.includes(role as UserRole)) {
    err(res, 'INVALID_ROLE', `Role must be one of: ${VALID_ROLES.join(', ')}`, 422);
    return;
  }

  await db
    .update(user)
    .set({ role: role as UserRole, status: 'ACTIVE', updatedAt: new Date() })
    .where(eq(user.id, req.user!.id));

  ok(res, { role, status: 'ACTIVE' });
});

/**
 * GET /api/v1/users/me/entitlements
 * Returns current premium tier + per-feature flags + today's quota usage.
 */
usersRouter.get('/me/entitlements', authenticate, async (req: Request, res: Response) => {
  const resolved = await getProfileTier(req.user!.id);
  if (!resolved) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
  const ent = getEntitlements(resolved.tier);
  const quota = await peekInterestQuota(resolved.profileId, resolved.tier);
  ok(res, {
    tier: resolved.tier,
    entitlements: {
      ...ent,
      dailyInterestLimit: Number.isFinite(ent.dailyInterestLimit) ? ent.dailyInterestLimit : null,
    },
    quotas: {
      interestsToday: {
        used: quota.used,
        limit: Number.isFinite(quota.limit) ? quota.limit : null,
        remaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
      },
    },
  });
});

/**
 * GET /api/v1/users/me/notifications?limit=50&unreadOnly=true
 * Lists most-recent notifications + the unread count (one round trip so the
 * bell can hydrate badge + list from a single server fetch).
 */
usersRouter.get('/me/notifications', authenticate, async (req: Request, res: Response) => {
  const parsed = NotificationListQuerySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;
  const unreadOnly = parsed.success ? parsed.data.unreadOnly : false;
  const userId = req.user!.id;

  const where = unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.read, false))
    : eq(notifications.userId, userId);

  const [items, unreadRows] = await Promise.all([
    db.select().from(notifications).where(where)
      .orderBy(desc(notifications.createdAt)).limit(limit),
    db.select({ value: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
  ]);

  ok(res, { items, unreadCount: Number(unreadRows[0]?.value ?? 0) });
});

/** GET /me/notifications/unread-count — cheap badge poll / recovery */
usersRouter.get('/me/notifications/unread-count', authenticate, async (req: Request, res: Response) => {
  const [row] = await db.select({ value: count() }).from(notifications)
    .where(and(eq(notifications.userId, req.user!.id), eq(notifications.read, false)));
  ok(res, { unreadCount: Number(row?.value ?? 0) });
});

/** POST /me/notifications/:id/read — mark single notification read */
usersRouter.post('/me/notifications/:id/read', authenticate, async (req: Request, res: Response) => {
  const id = req.params['id'] ?? '';
  await db.update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
  ok(res, { ok: true });
});

/** POST /me/notifications/:id/unread — mark single notification unread */
usersRouter.post('/me/notifications/:id/unread', authenticate, async (req: Request, res: Response) => {
  const id = req.params['id'] ?? '';
  await db.update(notifications)
    .set({ read: false })
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
  ok(res, { ok: true });
});

/** POST /me/notifications/read-all — mark all read */
usersRouter.post('/me/notifications/read-all', authenticate, async (req: Request, res: Response) => {
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, req.user!.id));
  ok(res, { ok: true });
});

/** DELETE /me/notifications/:id — clear a single notification (hard delete) */
usersRouter.delete('/me/notifications/:id', authenticate, async (req: Request, res: Response) => {
  const id = req.params['id'] ?? '';
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
  ok(res, { ok: true });
});

/** DELETE /me/notifications — clear ALL notifications for the user */
usersRouter.delete('/me/notifications', authenticate, async (req: Request, res: Response) => {
  await db.delete(notifications).where(eq(notifications.userId, req.user!.id));
  ok(res, { ok: true });
});

/** GET /me/notification-preferences */
usersRouter.get('/me/notification-preferences', authenticate, async (req: Request, res: Response) => {
  const [row] = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, req.user!.id));
  if (!row) {
    ok(res, { push: true, sms: true, email: true, inApp: true, marketing: false, mutedTypes: [] });
    return;
  }
  ok(res, {
    push:       row.push,
    sms:        row.sms,
    email:      row.email,
    inApp:      row.inApp,
    marketing:  row.marketing,
    mutedTypes: (row.mutedTypes as string[] | null) ?? [],
  });
});

/** PUT /me/notification-preferences — upsert */
usersRouter.put('/me/notification-preferences', authenticate, async (req: Request, res: Response) => {
  const parsed = NotificationPrefsSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'BAD_REQUEST', 'Invalid input', 400); return; }

  const userId = req.user!.id;
  const [existing] = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  if (existing) {
    await db.update(notificationPreferences)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({
      userId,
      push:       parsed.data.push ?? true,
      sms:        parsed.data.sms ?? true,
      email:      parsed.data.email ?? true,
      inApp:      parsed.data.inApp ?? true,
      marketing:  parsed.data.marketing ?? false,
      mutedTypes: parsed.data.mutedTypes ?? [],
    });
  }
  ok(res, { ok: true });
});

/** POST /me/devices — register/refresh device push token */
usersRouter.post('/me/devices', authenticate, async (req: Request, res: Response) => {
  const parsed = RegisterDeviceSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'BAD_REQUEST', 'Invalid input', 400); return; }

  const userId = req.user!.id;
  const { token, platform, appVersion } = parsed.data;
  const insertVals = appVersion
    ? { userId, token, platform, appVersion, lastSeenAt: new Date() }
    : { userId, token, platform, lastSeenAt: new Date() };
  await db.insert(deviceTokens).values(insertVals)
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set:    appVersion
        ? { userId, platform, appVersion, lastSeenAt: new Date() }
        : { userId, platform, lastSeenAt: new Date() },
    });
  ok(res, { ok: true });
});

/** DELETE /me/devices/:token — unregister */
usersRouter.delete('/me/devices/:token', authenticate, async (req: Request, res: Response) => {
  const token = req.params['token'] ?? '';
  await db.delete(deviceTokens)
    .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, req.user!.id)));
  ok(res, { ok: true });
});
