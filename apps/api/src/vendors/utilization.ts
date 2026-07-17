/**
 * Vendor Utilization Engine — API Router
 *
 * GET /  → listUtilizationOpportunities (auth)
 *
 * Returns ranked capacity windows for authenticated vendor + computed scores.
 * Query params:
 *   - eventType?: CORPORATE | FESTIVAL | COMMUNITY | COMMUNITY_EVENT | GOVERNMENT | SCHOOL
 *   - startAfter?: ISO timestamp
 *   - endBefore?: ISO timestamp
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import { eq } from 'drizzle-orm';
import {
  queryVendorUtilizationOpportunities,
  computeUtilizationScore,
} from './utilization.service.js';

const router = Router();

/**
 * List utilization opportunities for the authenticated vendor.
 * Returns ranked windows + computed scores.
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const profileId = await resolveProfileId(req.user!.id);
      if (!profileId) {
        err(res, 'NO_PROFILE', 'User has no vendor profile', 404);
        return;
      }

      // Resolve the vendor by userId — vendors.id, profiles.id and userId are
      // three distinct values (CLAUDE.md rule 12). vendor_event_types is keyed by
      // vendors.id; vendor_capacity by profiles.id.
      const vendorRow = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.userId, req.user!.id))
        .limit(1)
        .then((r) => r[0]);

      if (!vendorRow) {
        err(res, 'NOT_VENDOR', 'User is not a vendor', 403);
        return;
      }

      // Parse and validate query params
      const QuerySchema = z.object({
        eventType: z.enum([
          'CORPORATE',
          'FESTIVAL',
          'COMMUNITY',
          'COMMUNITY_EVENT',
          'GOVERNMENT',
          'SCHOOL',
        ] as const).optional(),
        startAfter: z.string().datetime().optional(),
        endBefore: z.string().datetime().optional(),
      });

      const query = QuerySchema.parse(req.query);

      const now = new Date();

      // Query and rank opportunities
      const rankedWindows = await queryVendorUtilizationOpportunities({
        profileId,
        vendorId: vendorRow.id,
        eventType: query.eventType,
        startAfter: query.startAfter,
        endBefore: query.endBefore,
        referenceDate: now,
      });

      // Build response: include computed scores
      const opportunities = rankedWindows.map((rw) => ({
        window: rw.window,
        eventTypeMatch: rw.eventTypeMatch,
        remainingCapacity: rw.remainingCapacity,
        utilizationScore: computeUtilizationScore(rw, now),
        // expectedMarginPaise: computed from lead_fee (sample value; no actual lead lookup here)
        // In production, this would hydrate from vendor_leads when available
      }));

      ok(res, {
        opportunities,
        count: opportunities.length,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        err(res, 'INVALID_PARAMS', 'Invalid query parameters', 400, {
          errors: e.errors,
        });
        return;
      }
      err(res, 'INTERNAL_ERROR', (e as Error).message, 500);
    }
  },
);

export default router;
