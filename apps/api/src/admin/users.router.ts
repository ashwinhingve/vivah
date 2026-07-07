/**
 * Admin User Management router — search/list, detail, and suspend/reactivate
 * for every account on the platform.
 *
 * Routes (mounted at /api/v1/admin):
 *   GET   /users                    search + filter (role/status), paginated
 *   GET   /users/:userId            user row + linked profileId/vendorId
 *   PATCH /users/:userId/status     suspend/reactivate — writes an audit log
 *
 * Suspend/reactivate never deletes anything — it flips `user.status` and
 * appends an immutable USER_SUSPENDED audit event via the same
 * `appendAuditLog` helper the payments/escrow flows use, so the hash chain
 * stays intact (never insert into audit_logs directly).
 */
import { createHash } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq, ilike, or, desc, sql } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { user, profiles, vendors, userRoleEnum, userStatusEnum } from '@smartshaadi/db';
import { ok, err } from '../lib/response.js';
import { appendAuditLog } from '../payments/service.js';

export const adminUsersRouter = Router();

// audit_logs.entityId is a Postgres `uuid` column, but Better Auth user ids
// are nanoid text — not valid uuid syntax. Deterministically derive a
// uuid-shaped id from the userId (same input always reproduces the same
// value) so the hash chain stays queryable by entityId while the real
// Better Auth id is preserved in the payload for lookups.
function userAuditEntityId(userId: string): string {
  const h = createHash('sha256').update(`user:${userId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// GET /admin/users — search + filter, paginated
// ---------------------------------------------------------------------------

const UsersQuerySchema = z.object({
  q:      z.string().trim().min(1).optional(),
  role:   z.enum(userRoleEnum.enumValues).optional(),
  status: z.enum(userStatusEnum.enumValues).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

adminUsersRouter.get(
  '/users',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UsersQuerySchema.safeParse(req.query);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { q, role, status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (q) {
      conditions.push(
        or(
          ilike(user.name, `%${q}%`),
          ilike(user.email, `%${q}%`),
          ilike(user.phoneNumber, `%${q}%`),
        ),
      );
    }
    if (role)   conditions.push(eq(user.role, role));
    if (status) conditions.push(eq(user.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id:        user.id,
        name:      user.name,
        email:     user.email,
        phone:     user.phoneNumber,
        role:      user.role,
        status:    user.status,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(whereClause);
    const total = countRow?.count ?? 0;

    ok(res, { items: rows, total, page, limit });
  },
);

// ---------------------------------------------------------------------------
// GET /admin/users/:userId — detail + linked profile/vendor ids
// ---------------------------------------------------------------------------

adminUsersRouter.get(
  '/users/:userId',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.params['userId'] ?? '';
    const [row] = await db
      .select({
        id:            user.id,
        name:          user.name,
        email:         user.email,
        phone:         user.phoneNumber,
        role:          user.role,
        status:        user.status,
        createdAt:     user.createdAt,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneNumberVerified,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) { err(res, 'NOT_FOUND', 'User not found', 404); return; }

    const [profileRow] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    const [vendorRow] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    ok(res, {
      user:      row,
      profileId: profileRow?.id ?? null,
      vendorId:  vendorRow?.id ?? null,
    });
  },
);

// ---------------------------------------------------------------------------
// PATCH /admin/users/:userId/status — suspend / reactivate
// ---------------------------------------------------------------------------

const StatusBodySchema = z.object({
  status: z.enum(['SUSPENDED', 'ACTIVE']),
  reason: z.string().trim().min(10).max(500).optional(),
});

adminUsersRouter.patch(
  '/users/:userId/status',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.params['userId'] ?? '';
    const parsed = StatusBodySchema.safeParse(req.body);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { status, reason } = parsed.data;

    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
    if (!existing) { err(res, 'NOT_FOUND', 'User not found', 404); return; }

    const [updated] = await db
      .update(user)
      .set({ status, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({ id: user.id, status: user.status });

    await appendAuditLog({
      eventType:  'USER_SUSPENDED',
      entityType: 'user',
      entityId:   userAuditEntityId(userId),
      actorId:    req.user!.id,
      payload:    { targetUserId: userId, newStatus: status, reason: reason ?? null },
    });

    ok(res, { user: updated });
  },
);
