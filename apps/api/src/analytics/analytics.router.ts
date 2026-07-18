/**
 * Smart Shaadi — Analytics Router.
 *
 *   GET /vendors/:vendorId/forecast   — vendor forecast (owner or admin/support)
 *   GET /admin/forecast                — platform forecast (admin/support only)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { vendors, profiles } from '@smartshaadi/db';
import { asProfileId } from '@smartshaadi/types';
import {
  getVendorForecast,
  getAdminForecast,
  AnalyticsServiceError,
} from './analytics.service.js';

export const analyticsRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof AnalyticsServiceError) {
    const map: Record<string, number> = { FORBIDDEN: 403 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Analytics error', 500);
}

// ── GET /vendors/:vendorId/forecast ───────────────────────────────────────────

analyticsRouter.get(
  '/vendors/:vendorId/forecast',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const vendorIdParam = req.params['vendorId'];
    const vendorIdResult = z.string().uuid().safeParse(vendorIdParam);

    if (!vendorIdResult.success) {
      err(res, 'VALIDATION_ERROR', 'vendorId must be a valid UUID', 400);
      return;
    }

    try {
      const vendorId = vendorIdResult.data;

      // Fetch vendor + its owning profile in one query. vendor_capacity is keyed
      // by profiles.id (the owner's profileId) — NOT vendors.id — so resolve the
      // owner's profileId here (userId ≠ vendorId ≠ profileId; CLAUDE.md rule 12).
      const [vendor] = await db
        .select({
          id: vendors.id,
          userId: vendors.userId,
          profileId: profiles.id,
        })
        .from(vendors)
        .innerJoin(profiles, eq(profiles.userId, vendors.userId))
        .where(eq(vendors.id, vendorId))
        .limit(1);

      if (!vendor) {
        err(res, 'NOT_FOUND', 'Vendor not found', 404);
        return;
      }

      // Authorization: owner or admin/support
      const role = req.user!.role;
      const isOwner = vendor.userId === req.user!.id;
      const isStaff = role === 'ADMIN' || role === 'SUPPORT';

      if (!isOwner && !isStaff) {
        err(res, 'FORBIDDEN', 'Not authorized to view this vendor forecast', 403);
        return;
      }

      // Fetch forecast: utilization by profileId, revenue by vendorId.
      const forecast = await getVendorForecast(vendorId, asProfileId(vendor.profileId));
      ok(res, forecast);
    } catch (e) {
      handle(res, e);
    }
  }),
);

// ── GET /admin/forecast ──────────────────────────────────────────────────────

analyticsRouter.get(
  '/admin/forecast',
  authenticate,
  authorize(['ADMIN', 'SUPPORT']),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      const forecast = await getAdminForecast();
      ok(res, forecast);
    } catch (e) {
      handle(res, e);
    }
  }),
);
