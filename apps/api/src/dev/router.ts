import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { user } from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { ok, err } from '../lib/response.js';

export const devRouter = Router();

const VALID_ROLES = ['INDIVIDUAL', 'FAMILY_MEMBER', 'VENDOR', 'EVENT_COORDINATOR', 'ADMIN', 'SUPPORT'];

devRouter.post('/switch-role', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { role } = req.body as { role?: string };
  if (!role || !VALID_ROLES.includes(role)) {
    err(res, 'INVALID_ROLE', `role must be one of: ${VALID_ROLES.join(', ')}`, 400);
    return;
  }
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, req.user!.id));
  ok(res, { success: true, newRole: role });
});
