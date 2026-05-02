/**
 * Admin vendor router — set commission, verify bank account.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import { ok, err } from '../lib/response.js';

export const adminVendorsRouter = Router();

const SetCommissionSchema = z.object({ pct: z.number().min(0).max(50) });

adminVendorsRouter.put('/vendors/:id/commission', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  const parsed = SetCommissionSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'BAD_REQUEST', 'Invalid pct (0–50)', 400); return; }
  const id = req.params['id'] ?? '';
  await db.update(vendors).set({ commissionPct: parsed.data.pct.toFixed(2) }).where(eq(vendors.id, id));
  ok(res, { ok: true });
});

adminVendorsRouter.post('/vendors/:id/verify-bank', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  const id = req.params['id'] ?? '';
  // TODO(future): integrate Razorpay Fund Account ₹1 verification flow.
  await db.update(vendors).set({ bankVerificationStatus: 'VERIFIED' }).where(eq(vendors.id, id));
  ok(res, { status: 'VERIFIED' });
});
