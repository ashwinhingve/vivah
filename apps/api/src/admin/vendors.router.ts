/**
 * Admin vendor router — commission, bank verification, and the
 * vendor-approval workflow (P1-8 / docs/PHASE-1-4-AUDIT.md).
 *
 * Routes:
 *   GET    /admin/vendors/queue        list pending/under-review/recent
 *   GET    /admin/vendors/:id          full vendor detail for review
 *   POST   /admin/vendors/:id/start-review
 *   POST   /admin/vendors/:id/approve
 *   POST   /admin/vendors/:id/reject       body: { reason, category }
 *   POST   /admin/vendors/:id/suspend      body: { reason }
 *   POST   /admin/vendors/:id/reinstate
 *   PUT    /vendors/:id/commission     (pre-existing)
 *   POST   /vendors/:id/verify-bank    (pre-existing)
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { vendors, vendorStatusEnum, rejectionCategoryEnum } from '@smartshaadi/db';
import { ok, err } from '../lib/response.js';
import {
  startReview,
  approve,
  reject as rejectVendor,
  suspend,
  reinstate,
  VendorApprovalError,
} from '../vendors/approval.service.js';

export const adminVendorsRouter = Router();

// ---------------------------------------------------------------------------
// GET /admin/vendors/queue — list vendors needing review
// ---------------------------------------------------------------------------

const QueueQuerySchema = z.object({
  status: z.enum(vendorStatusEnum.enumValues).default('PENDING'),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  page:   z.coerce.number().int().min(1).default(1),
  search: z.string().trim().optional(),
});

adminVendorsRouter.get(
  '/admin/vendors/queue',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = QueueQuerySchema.safeParse(req.query);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { status, limit, page, search } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(vendors.status, status)];
    if (search) conditions.push(ilike(vendors.businessName, `%${search}%`));

    const rows = await db
      .select({
        id:                vendors.id,
        userId:            vendors.userId,
        businessName:      vendors.businessName,
        category:          vendors.category,
        city:              vendors.city,
        state:             vendors.state,
        status:            vendors.status,
        submittedAt:       vendors.submittedAt,
        reviewedAt:        vendors.reviewedAt,
        reviewedByUserId:  vendors.reviewedByUserId,
        rejectionReason:   vendors.rejectionReason,
        rejectionCategory: vendors.rejectionCategory,
      })
      .from(vendors)
      .where(and(...conditions))
      .orderBy(vendors.submittedAt, desc(vendors.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vendors)
      .where(and(...conditions));
    const total = countRow?.count ?? 0;

    ok(res, { items: rows, total, page, limit });
  },
);

// ---------------------------------------------------------------------------
// GET /admin/vendors/:id — full detail
// ---------------------------------------------------------------------------

adminVendorsRouter.get(
  '/admin/vendors/:id',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const [row] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!row) { err(res, 'NOT_FOUND', 'Vendor not found', 404); return; }
    ok(res, { vendor: row });
  },
);

// ---------------------------------------------------------------------------
// State-transition endpoints
// ---------------------------------------------------------------------------

function mapApprovalError(res: Response, e: unknown): void {
  if (e instanceof VendorApprovalError) {
    const status =
      e.code === 'VENDOR_NOT_FOUND'              ? 404 :
      e.code === 'STATUS_CHANGED_CONCURRENTLY'   ? 409 :
      e.code === 'INCOMPLETE_PROFILE'            ? 422 :
      e.code === 'REASON_TOO_SHORT'              ? 422 :
                                                   400;
    err(res, e.code, e.message, status);
    return;
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Unknown error', 500);
}

adminVendorsRouter.post(
  '/admin/vendors/:id/start-review',
  authenticate, authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const updated = await startReview(req.user!.id, req.params['id'] ?? '');
      ok(res, { vendor: updated });
    } catch (e) { mapApprovalError(res, e); }
  },
);

adminVendorsRouter.post(
  '/admin/vendors/:id/approve',
  authenticate, authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const updated = await approve(req.user!.id, req.params['id'] ?? '');
      ok(res, { vendor: updated });
    } catch (e) { mapApprovalError(res, e); }
  },
);

const RejectBodySchema = z.object({
  reason:   z.string().trim().min(10).max(500),
  category: z.enum(rejectionCategoryEnum.enumValues),
});

adminVendorsRouter.post(
  '/admin/vendors/:id/reject',
  authenticate, authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = RejectBodySchema.safeParse(req.body);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    try {
      const updated = await rejectVendor(
        req.user!.id, req.params['id'] ?? '', parsed.data.reason, parsed.data.category,
      );
      ok(res, { vendor: updated });
    } catch (e) { mapApprovalError(res, e); }
  },
);

const SuspendBodySchema = z.object({ reason: z.string().trim().min(10).max(500) });

adminVendorsRouter.post(
  '/admin/vendors/:id/suspend',
  authenticate, authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = SuspendBodySchema.safeParse(req.body);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    try {
      const updated = await suspend(req.user!.id, req.params['id'] ?? '', parsed.data.reason);
      ok(res, { vendor: updated });
    } catch (e) { mapApprovalError(res, e); }
  },
);

adminVendorsRouter.post(
  '/admin/vendors/:id/reinstate',
  authenticate, authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const updated = await reinstate(req.user!.id, req.params['id'] ?? '');
      ok(res, { vendor: updated });
    } catch (e) { mapApprovalError(res, e); }
  },
);

// ---------------------------------------------------------------------------
// Pre-existing — commission + bank verify
// ---------------------------------------------------------------------------

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
