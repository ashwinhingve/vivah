/**
 * Vendor Leads — Tier 3 Track 2 (pay-per-qualified-lead).
 *
 *   POST  /api/v1/vendor-leads              — any authenticated customer
 *   GET   /api/v1/vendor-leads/my           — vendor owner (resolves vendor by req.user)
 *   GET   /api/v1/vendor-leads/stats        — vendor owner
 *   PATCH /api/v1/admin/vendor-leads/:id    — ADMIN/SUPPORT — qualify or refund
 *
 * The admin PATCH route is mounted under /api/v1/admin/* via a second
 * sub-router (vendorLeadsAdminRouter) so the existing _p3Register shim can
 * wire both with a single import.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import {
  createLead,
  markLeadQualified,
  refundLead,
  getVendorLeads,
  getVendorLeadStats,
  VendorLeadError,
} from '../services/vendorLeadService.js';

export const vendorLeadsRouter      = Router();
export const vendorLeadsAdminRouter = Router();

const EVENT_TYPE_VALUES = [
  'WEDDING', 'HALDI', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'RECEPTION',
  'CORPORATE', 'FESTIVAL', 'COMMUNITY', 'COMMUNITY_EVENT',
  'GOVERNMENT', 'SCHOOL', 'OTHER',
] as const;

const FEE_STATUS_VALUES = [
  'PENDING', 'QUALIFIED', 'CHARGED', 'REFUNDED', 'CANCELLED', 'PENDING_PAYMENT',
] as const;

const CreateLeadSchema = z.object({
  vendor_id:      z.string().uuid(),
  event_type:     z.enum(EVENT_TYPE_VALUES),
  event_date:     z.string().refine(s => !Number.isNaN(Date.parse(s)), 'invalid date').optional().nullable(),
  event_location: z.string().trim().max(200).optional().nullable(),
  message:        z.string().trim().max(2000).optional().nullable(),
});

const ListQuerySchema = z.object({
  status: z.enum(FEE_STATUS_VALUES).optional(),
  limit:  z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const AdminPatchSchema = z.discriminatedUnion('action', [
  z.object({
    action:  z.literal('qualify'),
    quality: z.enum(['HIGH', 'MEDIUM', 'LOW', 'SPAM']),
  }),
  z.object({
    action: z.literal('refund'),
    reason: z.string().trim().min(3).max(500),
  }),
]);

function leadErrToStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':     return 404;
    case 'INACTIVE':      return 409;
    case 'INVALID_STATE': return 409;
    case 'SELF_LEAD':     return 400;
    case 'VENDOR_GONE':   return 410;
    default:              return 400;
  }
}

/** Resolves the authenticated user's vendor row, or null if they aren't a vendor. */
async function resolveOwnedVendor(userId: string): Promise<{ id: string } | null> {
  const [v] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);
  return v ?? null;
}

// ── POST /api/v1/vendor-leads ─────────────────────────────────────────────────
vendorLeadsRouter.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }

    try {
      const lead = await createLead({
        vendorId:       parsed.data.vendor_id,
        inquirerUserId: req.user!.id,
        eventType:      parsed.data.event_type,
        eventDate:      parsed.data.event_date ? new Date(parsed.data.event_date) : null,
        eventLocation:  parsed.data.event_location ?? null,
        message:        parsed.data.message ?? null,
      });
      ok(res, { lead }, 201);
    } catch (e) {
      if (e instanceof VendorLeadError) {
        err(res, e.code, e.message, leadErrToStatus(e.code));
        return;
      }
      throw e;
    }
  }),
);

// ── GET /api/v1/vendor-leads/my ───────────────────────────────────────────────
vendorLeadsRouter.get(
  '/my',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const vendor = await resolveOwnedVendor(req.user!.id);
    if (!vendor) {
      err(res, 'NOT_VENDOR', 'No vendor account linked to this user', 403);
      return;
    }
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }
    const filters: { status?: typeof FEE_STATUS_VALUES[number]; limit?: number; offset?: number } = {};
    if (parsed.data.status !== undefined) filters.status = parsed.data.status;
    if (parsed.data.limit  !== undefined) filters.limit  = parsed.data.limit;
    if (parsed.data.offset !== undefined) filters.offset = parsed.data.offset;
    const leads = await getVendorLeads(vendor.id, filters);
    ok(res, { leads });
  }),
);

// ── GET /api/v1/vendor-leads/stats ────────────────────────────────────────────
vendorLeadsRouter.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const vendor = await resolveOwnedVendor(req.user!.id);
    if (!vendor) {
      err(res, 'NOT_VENDOR', 'No vendor account linked to this user', 403);
      return;
    }
    const stats = await getVendorLeadStats(vendor.id);
    ok(res, { stats });
  }),
);

// ── PATCH /api/v1/admin/vendor-leads/:id ──────────────────────────────────────
vendorLeadsAdminRouter.patch(
  '/vendor-leads/:id',
  authenticate,
  authorize(['ADMIN', 'SUPPORT']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idParse = z.string().uuid().safeParse(req.params['id']);
    if (!idParse.success) {
      err(res, 'VALIDATION_ERROR', 'lead id must be a UUID', 400);
      return;
    }
    const parsed = AdminPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid action', 400);
      return;
    }

    try {
      const updated = parsed.data.action === 'qualify'
        ? await markLeadQualified(idParse.data, parsed.data.quality)
        : await refundLead(idParse.data, parsed.data.reason);
      ok(res, { lead: updated });
    } catch (e) {
      if (e instanceof VendorLeadError) {
        err(res, e.code, e.message, leadErrToStatus(e.code));
        return;
      }
      throw e;
    }
  }),
);
