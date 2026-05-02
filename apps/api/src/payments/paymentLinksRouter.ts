/**
 * Smart Shaadi — Payment Links Router.
 *
 * POST /payment-links              → create a shareable payment link
 * GET  /payment-links/mine         → list my links
 * POST /payment-links/:id/cancel   → cancel an active link
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { CreatePaymentLinkSchema } from '@smartshaadi/schemas';
import {
  createLink,
  listMyLinks,
  cancelLink,
  PaymentLinkError,
} from './paymentLinks.js';

export const paymentLinksRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof PaymentLinkError) {
    const map: Record<string, number> = { NOT_FOUND: 404, INVALID_STATE: 422 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Link error', 500);
}

paymentLinksRouter.post('/', authenticate, async (req: Request, res: Response) => {
  const parse = CreatePaymentLinkSchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const link = await createLink(req.user!.id, parse.data);
    ok(res, link, 201);
  } catch (e) { handle(res, e); }
});

paymentLinksRouter.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await listMyLinks(req.user!.id);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

paymentLinksRouter.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  const id = req.params['id'];
  if (!id) return err(res, 'VALIDATION_ERROR', 'id required', 422);
  try {
    const updated = await cancelLink(req.user!.id, id);
    ok(res, updated);
  } catch (e) { handle(res, e); }
});
