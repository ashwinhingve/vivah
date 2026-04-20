import { Router, type Request, type Response } from 'express';
import { sql, and, gte, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { user, vendors, bookings } from '@smartshaadi/db';

export const adminStatsRouter: Router = Router();

/**
 * GET /api/v1/admin/stats
 * Returns headline platform counts for the admin dashboard.
 */
adminStatsRouter.get(
  '/stats',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const [userCountRow] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(user);

      const [vendorCountRow] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(vendors)
        .where(eq(vendors.isActive, true));

      const [bookingCountRow] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(bookings)
        .where(and(gte(bookings.createdAt, monthStart)));

      ok(res, {
        totalUsers:         userCountRow?.count ?? 0,
        activeVendors:      vendorCountRow?.count ?? 0,
        bookingsThisMonth:  bookingCountRow?.count ?? 0,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load stats';
      err(res, 'STATS_ERROR', message, 500);
    }
  },
);
