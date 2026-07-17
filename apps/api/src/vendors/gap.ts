/**
 * Smart Shaadi — Vendor Gap Detection Router (Phase 5 Sprint B, Unit 5.3)
 *
 *   GET /api/v1/admin/vendor-gaps?threshold=N   ADMIN-only supply-gap report
 *
 * Flags under-supplied (city × category) markets. Admin-gated via authorize.
 * Standard { success, data, error, meta } envelope.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { VendorGapQuerySchema } from '@smartshaadi/schemas';
import { getSupplyGapReport, DEFAULT_GAP_THRESHOLD } from './gap.service.js';

export const gapRouter: Router = Router();

gapRouter.get(
  '/vendor-gaps',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = VendorGapQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }
    try {
      const report = await getSupplyGapReport(parsed.data.threshold ?? DEFAULT_GAP_THRESHOLD);
      ok(res, report);
    } catch (e) {
      err(res, 'INTERNAL_ERROR', (e as Error).message, 500);
    }
  },
);
