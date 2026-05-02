/**
 * Smart Shaadi — Payments Analytics Router (admin only).
 *
 * GET /payments/admin/analytics/summary       → revenue summary
 * GET /payments/admin/analytics/daily         → daily revenue points
 * GET /payments/admin/analytics/categories    → revenue by vendor category
 * GET /payments/admin/analytics/top-vendors   → top N vendors
 * GET /payments/admin/analytics/liabilities   → escrow + wallet open balances
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  getRevenueSummary,
  getDailyRevenue,
  getRevenueByCategory,
  getTopVendorsByRevenue,
  getOpenLiabilities,
  AnalyticsError,
} from './analytics.js';

export const analyticsRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof AnalyticsError) {
    const map: Record<string, number> = { FORBIDDEN: 403 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Analytics error', 500);
}

const range = (req: Request) => ({
  fromDate: (req.query['fromDate'] as string | undefined) ?? undefined,
  toDate:   (req.query['toDate']   as string | undefined) ?? undefined,
});

analyticsRouter.get('/summary', authenticate, async (req: Request, res: Response) => {
  const { fromDate, toDate } = range(req);
  try { ok(res, await getRevenueSummary(req.user!.id, fromDate, toDate)); } catch (e) { handle(res, e); }
});

analyticsRouter.get('/daily', authenticate, async (req: Request, res: Response) => {
  const { fromDate, toDate } = range(req);
  try { ok(res, await getDailyRevenue(req.user!.id, fromDate, toDate)); } catch (e) { handle(res, e); }
});

analyticsRouter.get('/categories', authenticate, async (req: Request, res: Response) => {
  const { fromDate, toDate } = range(req);
  try { ok(res, await getRevenueByCategory(req.user!.id, fromDate, toDate)); } catch (e) { handle(res, e); }
});

analyticsRouter.get('/top-vendors', authenticate, async (req: Request, res: Response) => {
  const { fromDate, toDate } = range(req);
  const limit = Math.min(50, parseInt((req.query['limit'] as string | undefined) ?? '10', 10) || 10);
  try { ok(res, await getTopVendorsByRevenue(req.user!.id, limit, fromDate, toDate)); } catch (e) { handle(res, e); }
});

analyticsRouter.get('/liabilities', authenticate, async (req: Request, res: Response) => {
  try { ok(res, await getOpenLiabilities(req.user!.id)); } catch (e) { handle(res, e); }
});
