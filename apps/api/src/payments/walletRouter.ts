/**
 * Smart Shaadi — Wallet Router.
 *
 * GET  /wallet                  → my wallet snapshot
 * GET  /wallet/transactions     → my ledger
 * POST /wallet/admin/adjust     → admin manual credit/debit
 */
import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { WalletAdjustSchema } from '@smartshaadi/schemas';
import { z } from 'zod';
import {
  getWallet,
  listTransactions,
  adminAdjustWallet,
  createWalletTopupOrder,
  WalletError,
} from './wallet.js';

export const walletRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof WalletError) {
    const map: Record<string, number> = { FORBIDDEN: 403, INSUFFICIENT_BALANCE: 422, WALLET_INACTIVE: 422, INVALID_AMOUNT: 400 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Wallet error', 500);
}

walletRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const wallet = await getWallet(req.user!.id);
    ok(res, wallet);
  } catch (e) { handle(res, e); }
});

walletRouter.get('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await listTransactions(req.user!.id);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

walletRouter.post('/admin/adjust', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
  const parse = WalletAdjustSchema.safeParse(req.body);
  if (!parse.success) return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid', 422);
  try {
    const txn = await adminAdjustWallet(req.user!.id, parse.data);
    ok(res, txn, 201);
  } catch (e) { handle(res, e); }
});

const TopupSchema = z.object({ amount: z.number().int().positive().max(100000) });

walletRouter.post('/topup', authenticate, async (req: Request, res: Response) => {
  const parsed = TopupSchema.safeParse(req.body);
  if (!parsed.success) return err(res, 'VALIDATION_ERROR', 'amount must be ₹1–₹100000', 422);
  try {
    const data = await createWalletTopupOrder(req.user!.id, parsed.data.amount);
    ok(res, data);
  } catch (e) { handle(res, e); }
});
