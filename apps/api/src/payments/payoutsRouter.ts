/**
 * Smart Shaadi — Payouts Router.
 *
 * Vendor:
 *   GET /payouts/vendor/mine         → my payouts list
 *   GET /payouts/vendor/summary      → lifetime summary
 *
 * Admin:
 *   POST /payouts/admin/schedule     → schedule a payout
 *   POST /payouts/admin/:id/process  → process now
 *   POST /payouts/admin/:id/retry    → retry failed
 *   GET  /payouts/admin/list         → list all (?status=)
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import * as schema from '@smartshaadi/db';
import { PayoutScheduleSchema } from '@smartshaadi/schemas';
import {
  schedulePayout,
  processPayout,
  listVendorPayouts,
  adminListAllPayouts,
  adminRetryPayout,
  getVendorPayoutSummary,
  PayoutError,
} from './payouts.js';

export const payoutsRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof PayoutError) {
    const map: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATE: 422, INVALID_AMOUNT: 400 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Payout error', 500);
}

async function vendorIdForUser(userId: string): Promise<string | null> {
  const [v] = await db.select({ id: schema.vendors.id }).from(schema.vendors).where(eq(schema.vendors.userId, userId)).limit(1);
  return v?.id ?? null;
}

payoutsRouter.get('/vendor/mine', authenticate, async (req: Request, res: Response) => {
  const vendorId = await vendorIdForUser(req.user!.id);
  if (!vendorId) return err(res, 'NOT_FOUND', 'Vendor profile not found for user', 404);
  try {
    const items = await listVendorPayouts(vendorId);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

payoutsRouter.get('/vendor/summary', authenticate, async (req: Request, res: Response) => {
  const vendorId = await vendorIdForUser(req.user!.id);
  if (!vendorId) return err(res, 'NOT_FOUND', 'Vendor profile not found for user', 404);
  try {
    const summary = await getVendorPayoutSummary(vendorId);
    ok(res, summary);
  } catch (e) { handle(res, e); }
});

async function assertAdmin(req: Request, res: Response): Promise<boolean> {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, req.user!.id))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') {
    err(res, 'FORBIDDEN', 'Admin role required', 403);
    return false;
  }
  return true;
}

payoutsRouter.post('/admin/schedule', authenticate, async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;
  const parse = PayoutScheduleSchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const result = await schedulePayout(parse.data);
    ok(res, result, 201);
  } catch (e) { handle(res, e); }
});

payoutsRouter.post('/admin/:id/process', authenticate, async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;
  const id = req.params['id'];
  if (!id) return err(res, 'VALIDATION_ERROR', 'id required', 422);
  try {
    await processPayout(id);
    ok(res, { processed: true });
  } catch (e) { handle(res, e); }
});

payoutsRouter.post('/admin/:id/retry', authenticate, async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;
  const id = req.params['id'];
  if (!id) return err(res, 'VALIDATION_ERROR', 'id required', 422);
  try {
    await adminRetryPayout(req.user!.id, id);
    ok(res, { retried: true });
  } catch (e) { handle(res, e); }
});

payoutsRouter.get('/admin/list', authenticate, async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;
  const status = (req.query['status'] as string | undefined) ?? undefined;
  try {
    const items = await adminListAllPayouts(100, status);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});
