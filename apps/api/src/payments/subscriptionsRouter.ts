import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  listPlans,
  getActiveSubscription,
  startSubscription,
  cancelSubscription,
} from './subscriptions.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/plans', async (_req, res) => {
  try {
    const data = await listPlans();
    ok(res, data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed';
    err(res, 'INTERNAL', msg, 500);
  }
});

subscriptionsRouter.get('/me', authenticate, async (req, res) => {
  try {
    const data = await getActiveSubscription(req.user!.id);
    ok(res, data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed';
    err(res, 'INTERNAL', msg, 500);
  }
});

const StartSubscriptionSchema = z.object({ planCode: z.string().min(1) });

subscriptionsRouter.post('/', authenticate, async (req, res) => {
  const parsed = StartSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'BAD_REQUEST', 'Invalid input', 400); return; }
  try {
    const data = await startSubscription(req.user!.id, parsed.data.planCode);
    ok(res, data);
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'INTERNAL';
    const status = (e as { status?: number }).status ?? 500;
    err(res, code, e instanceof Error ? e.message : 'Failed', status);
  }
});

const CancelSchema = z.object({ atCycleEnd: z.boolean().optional() });

subscriptionsRouter.delete('/:id', authenticate, async (req, res) => {
  const parsed = CancelSchema.safeParse(req.body);
  const atCycleEnd = parsed.success ? (parsed.data.atCycleEnd ?? true) : true;
  try {
    await cancelSubscription(req.user!.id, req.params['id'] ?? '', atCycleEnd);
    ok(res, { ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'INTERNAL';
    const status = (e as { status?: number }).status ?? 500;
    err(res, code, e instanceof Error ? e.message : 'Failed', status);
  }
});
