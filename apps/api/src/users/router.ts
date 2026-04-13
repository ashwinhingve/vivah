import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { user } from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import type { UserRole } from '@smartshaadi/types';

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
