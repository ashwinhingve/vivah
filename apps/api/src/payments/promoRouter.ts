/**
 * Smart Shaadi — Promo Router.
 *
 * POST /promos/quote          → quote a promo code (no redemption)
 * GET  /promos/active         → list active codes (?scope=)
 * POST /promos/admin/create   → admin: create
 * POST /promos/admin/deactivate/:code  → admin: deactivate
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { PromoApplySchema, CreatePromoSchema } from '@smartshaadi/schemas';
import {
  quotePromo,
  listActivePromos,
  adminCreatePromo,
  adminDeactivatePromo,
  PromoError,
} from './promo.js';

export const promoRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof PromoError) {
    const map: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, MIN_ORDER: 422, USAGE_LIMIT: 422, PER_USER_LIMIT: 422, FIRST_TIME_ONLY: 422, SCOPE_MISMATCH: 422 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Promo error', 500);
}

promoRouter.post('/quote', authenticate, async (req: Request, res: Response) => {
  const parse = PromoApplySchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const result = await quotePromo(req.user!.id, parse.data);
    ok(res, result);
  } catch (e) { handle(res, e); }
});

promoRouter.get('/active', authenticate, async (req: Request, res: Response) => {
  const scope = (req.query['scope'] as 'BOOKING' | 'STORE' | 'WEDDING' | undefined) ?? undefined;
  try {
    const items = await listActivePromos(scope);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

promoRouter.post('/admin/create', authenticate, async (req: Request, res: Response) => {
  const parse = CreatePromoSchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const promo = await adminCreatePromo(req.user!.id, parse.data);
    ok(res, promo, 201);
  } catch (e) { handle(res, e); }
});

promoRouter.post('/admin/deactivate/:code', authenticate, async (req: Request, res: Response) => {
  const code = req.params['code'];
  if (!code) return err(res, 'VALIDATION_ERROR', 'code required', 422);
  try {
    await adminDeactivatePromo(req.user!.id, code);
    ok(res, { deactivated: true });
  } catch (e) { handle(res, e); }
});
