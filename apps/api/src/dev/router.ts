import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { user, orders } from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { ok, err } from '../lib/response.js';
import { seedProfileContent } from './seedProfiles.js';
import { createDevMatch } from './createMatch.js';
import { seedCompatibleMatch } from './seedCompatibleMatch.js';
import { confirmOrder } from '../store/order.service.js';

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

devRouter.post('/seed-profiles', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await seedProfileContent();
    ok(res, result);
  } catch (e) {
    err(res, 'SEED_FAILED', e instanceof Error ? e.message : 'seed failed', 500);
  }
});

/**
 * POST /dev/create-match — fabricate an opposite-gender profile wired to match
 * the current user bilaterally, then warm the feed cache. Dev-only shortcut.
 */
devRouter.post('/create-match', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await createDevMatch(req.user!.id);
    ok(res, { success: true, ...result });
  } catch (e) {
    err(res, 'CREATE_MATCH_FAILED', e instanceof Error ? e.message : 'create match failed', 500);
  }
});

/**
 * POST /dev/seed-compatible-match — idempotent seed of a single fixed user
 * (phone +919999999002) engineered to match the current caller bilaterally.
 * Safe to call repeatedly — upserts Postgres rows and rewrites mockStore/Mongo
 * content on every invocation.
 */
devRouter.post('/seed-compatible-match', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await seedCompatibleMatch(req.user!.id);
    ok(res, { success: true, ...result });
  } catch (e) {
    err(res, 'SEED_COMPATIBLE_MATCH_FAILED', e instanceof Error ? e.message : 'seed compatible match failed', 500);
  }
});

// POST /dev/confirm-mock-payment — fake Razorpay capture for the demo flow.
// Accepts either { orderId } (customer-facing UUID) or { razorpayOrderId }.
// Resolves the order's razorpayOrderId when only orderId is supplied, then
// calls confirmOrder to flip PLACED → CONFIRMED and stamp a mock paymentId.
devRouter.post('/confirm-mock-payment', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { orderId, razorpayOrderId: bodyRzpId } = req.body as {
    orderId?: string;
    razorpayOrderId?: string;
  };
  try {
    let rzpOrderId = bodyRzpId;
    if (!rzpOrderId && orderId) {
      const [row] = await db
        .select({ razorpayOrderId: orders.razorpayOrderId })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!row || !row.razorpayOrderId) {
        err(res, 'ORDER_NOT_FOUND', 'order not found or has no razorpayOrderId', 404);
        return;
      }
      rzpOrderId = row.razorpayOrderId;
    }
    if (!rzpOrderId) {
      err(res, 'BAD_REQUEST', 'orderId or razorpayOrderId required', 400);
      return;
    }
    const mockPaymentId = `pay_mock_${Date.now()}`;
    await confirmOrder(rzpOrderId, mockPaymentId);
    ok(res, { success: true, razorpayOrderId: rzpOrderId, razorpayPaymentId: mockPaymentId });
  } catch (e) {
    err(res, 'CONFIRM_FAILED', e instanceof Error ? e.message : 'confirm failed', 500);
  }
});
