import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { user } from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { ok, err } from '../lib/response.js';

export const devRouter = Router();

const VALID_ROLES = ['INDIVIDUAL', 'FAMILY_MEMBER', 'VENDOR', 'EVENT_COORDINATOR', 'ADMIN', 'SUPPORT'];

devRouter.get('/session-debug', authenticate, (req: Request, res: Response): void => {
  ok(res, {
    userId: req.user!.id,
    role: req.user!.role,
    rawSession: JSON.stringify(req.user),
  });
});

devRouter.post('/switch-role', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { role } = req.body as { role?: string };
  if (!role || !VALID_ROLES.includes(role)) {
    err(res, 'INVALID_ROLE', `role must be one of: ${VALID_ROLES.join(', ')}`, 400);
    return;
  }
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, req.user!.id));
  // Expire the 5-min session cache cookie so the next request reads the new role from DB
  res.setHeader('Set-Cookie', [
    'better-auth.session_data=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    'better-auth.session_data.sig=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
  ]);
  ok(res, { success: true, newRole: role });
});
