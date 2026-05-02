/**
 * Smart Shaadi — Refunds Router.
 *
 * Customer endpoints:
 *   POST /refunds/request                       → request refund
 *   GET  /refunds/mine                          → list my refunds
 *
 * Admin endpoints:
 *   POST /refunds/admin/decide                  → approve / reject pending refund
 *   GET  /refunds/admin/list                    → list all refunds (?status=)
 */
import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { RequestRefundSchema, AdminApproveRefundSchema } from '@smartshaadi/schemas';
import {
  requestRefund,
  adminApproveRefund,
  listMyRefunds,
  listAllRefundsForAdmin,
  RefundError,
} from './refunds.js';

export const refundsRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof RefundError) {
    const map: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATE: 422, OVER_REFUND: 422, REFUND_IN_PROGRESS: 409, INVALID_AMOUNT: 400, CONCURRENT_UPDATE: 409 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Refund failed', 500);
}

refundsRouter.post('/request', authenticate, async (req: Request, res: Response) => {
  const parse = RequestRefundSchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const refund = await requestRefund(req.user!.id, parse.data, { autoApprove: false });
    ok(res, refund, 201);
  } catch (e) { handle(res, e); }
});

refundsRouter.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await listMyRefunds(req.user!.id);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

refundsRouter.post('/admin/decide', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  const parse = AdminApproveRefundSchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const result = await adminApproveRefund(req.user!.id, parse.data);
    ok(res, result);
  } catch (e) { handle(res, e); }
});

refundsRouter.get('/admin/list', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  const status = (req.query['status'] as string | undefined) ?? undefined;
  try {
    const items = await listAllRefundsForAdmin(req.user!.id, status);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});
