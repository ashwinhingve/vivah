/**
 * Smart Shaadi — Reports Router
 *
 *   GET /vendor/:vendorId/report   — vendor report (owner or admin/support)
 *   GET /admin/platform-report      — platform report (admin/support only)
 *
 * Mirrors the auth + vendor resolution pattern from analytics.router.ts.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { vendors, profiles } from '@smartshaadi/db';
import { asProfileId } from '@smartshaadi/types';
import { areReportsEnabled } from '../lib/env.js';
import {
  generatePlatformReport,
  generateVendorReport,
  ReportsServiceError,
} from './reports.service.js';

export const reportsRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof ReportsServiceError) {
    const map: Record<string, number> = { FORBIDDEN: 403 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Reports error', 500);
}

// ── Middleware: Check if reports are enabled ────────────────────────────────

function checkReportsEnabled(_req: Request, res: Response, next: () => void) {
  if (!areReportsEnabled) {
    err(res, 'SERVICE_UNAVAILABLE', 'PDF reports are temporarily unavailable', 503);
    return;
  }
  next();
}

reportsRouter.use(checkReportsEnabled);

// ── GET /vendor/:vendorId/report ────────────────────────────────────────────

reportsRouter.get(
  '/vendor/:vendorId/report',
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
          businessName: vendors.businessName,
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
        err(res, 'FORBIDDEN', 'Not authorized to view this vendor report', 403);
        return;
      }

      // Generate report
      const buffer = await generateVendorReport(
        vendorId,
        asProfileId(vendor.profileId),
        vendor.businessName || 'Vendor',
      );

      // Stream PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vendor-report-${vendorId.slice(0, 8)}.pdf"`,
      );
      res.send(buffer);
    } catch (e) {
      handle(res, e);
    }
  }),
);

// ── GET /admin/platform-report ──────────────────────────────────────────────

reportsRouter.get(
  '/admin/platform-report',
  authenticate,
  authorize(['ADMIN', 'SUPPORT']),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    try {
      // Generate report
      const buffer = await generatePlatformReport();

      // Stream PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="platform-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      );
      res.send(buffer);
    } catch (e) {
      handle(res, e);
    }
  }),
);
