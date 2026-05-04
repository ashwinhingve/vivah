/**
 * Smart Shaadi — Vendors Router
 *
 * GET    /vendors                       → listVendors        (public)
 * GET    /vendors/favorites             → listFavorites      (auth)
 * GET    /vendors/inquiries             → listVendorInquiries (auth, vendor)
 * GET    /vendors/inquiries/mine        → listMyInquiries    (auth, customer)
 * GET    /vendors/blocked-dates         → listBlockedDates   (auth, vendor)
 * POST   /vendors/blocked-dates         → addBlockedDate     (auth, vendor)
 * DELETE /vendors/blocked-dates/:id     → removeBlockedDate  (auth, vendor)
 *
 * GET    /vendors/:id                   → getVendor          (public)
 * PATCH  /vendors/:id                   → updateVendor       (auth, vendor owner)
 * GET    /vendors/:id/availability      → getAvailability    (public) ?month=YYYY-MM
 * GET    /vendors/:id/reviews           → listReviews        (public)
 * POST   /vendors/:id/reviews           → createReview       (auth)
 * POST   /vendors/:id/inquiries         → createInquiry      (auth)
 * POST   /vendors/:id/favorite          → addFavorite        (auth)
 * DELETE /vendors/:id/favorite          → removeFavorite     (auth)
 * POST   /vendors                       → createVendor       (auth)
 * POST   /vendors/:id/services          → addService         (auth, vendor owner)
 * POST   /vendors/reviews/:reviewId/reply → replyToReview    (auth, vendor)
 * POST   /vendors/inquiries/:inquiryId/reply → replyToInquiry (auth, vendor)
 */

import { Router, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  VendorListQuerySchema,
  CreateVendorSchema,
  CreateServiceSchema,
  VendorUpdateSchema,
  CreateReviewSchema,
  ReviewReplySchema,
  CreateInquirySchema,
  InquiryReplySchema,
  BlockedDateSchema,
} from '@smartshaadi/schemas';
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  addService,
  getAvailability,
  incrementViewCount,
  listVendorPackages,
  addVendorPackage,
  updateVendorPackage,
  removeVendorPackage,
  type VendorPackage,
} from './service.js';
import { z } from 'zod';
import {
  listReviews,
  createReview,
  replyToReview,
  ReviewError,
} from './reviews.service.js';
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  FavoriteError,
} from './favorites.service.js';
import {
  createInquiry,
  listVendorInquiries,
  listMyInquiries,
  replyToInquiry,
  InquiryError,
} from './inquiries.service.js';
import {
  listBlockedDates,
  addBlockedDate,
  removeBlockedDate,
  BlockedDateError,
} from './blockedDates.service.js';

export const vendorsRouter = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND:        404,
  FORBIDDEN:        403,
  CONFLICT:         409,
  INVALID_STATE:    422,
  VALIDATION_ERROR: 400,
};

function handleError(res: Response, e: unknown, fallbackCode = 'INTERNAL_ERROR'): void {
  if (
    e instanceof ReviewError ||
    e instanceof FavoriteError ||
    e instanceof InquiryError ||
    e instanceof BlockedDateError
  ) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, fallbackCode, msg, 500);
}

// ── GET /vendors ─────────────────────────────────────────────────────────────

vendorsRouter.get('/', async (req, res) => {
  const parsed = VendorListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await listVendors(parsed.data, req.user?.id);
    ok(res, result, 200);
  } catch (e) { handleError(res, e, 'VENDOR_LIST_ERROR'); }
});

// ── GET /vendors/me ───────────────────────────────────────────────────────────

vendorsRouter.get('/me', authenticate, async (req, res) => {
  try {
    const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, req.user!.id)).limit(1);
    if (!vendor) { err(res, 'NOT_FOUND', 'No vendor account', 404); return; }
    const result = await getVendor(vendor.id, req.user!.id);
    if (!result) { err(res, 'NOT_FOUND', 'Vendor not found', 404); return; }
    ok(res, result);
  } catch (e) { handleError(res, e); }
});

// ── GET /vendors/favorites — must come before /:id ────────────────────────────

vendorsRouter.get('/favorites', authenticate, async (req, res) => {
  try {
    const list = await listFavorites(req.user!.id);
    ok(res, { vendors: list });
  } catch (e) { handleError(res, e); }
});

// ── GET /vendors/inquiries (vendor-side inbox) ───────────────────────────────

vendorsRouter.get('/inquiries', authenticate, async (req, res) => {
  const status = (req.query['status'] as string | undefined)?.toUpperCase();
  const validStatus = (status === 'NEW' || status === 'REPLIED' || status === 'CONVERTED' || status === 'CLOSED') ? status : undefined;
  const page  = parseInt((req.query['page']  as string) ?? '1', 10) || 1;
  const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
  try {
    const result = await listVendorInquiries(req.user!.id, validStatus, page, limit);
    ok(res, result);
  } catch (e) { handleError(res, e); }
});

vendorsRouter.get('/inquiries/mine', authenticate, async (req, res) => {
  try {
    const list = await listMyInquiries(req.user!.id);
    ok(res, { inquiries: list });
  } catch (e) { handleError(res, e); }
});

vendorsRouter.post('/inquiries/:inquiryId/reply', authenticate, async (req, res) => {
  const inquiryId = req.params['inquiryId'];
  if (!inquiryId) { err(res, 'VALIDATION_ERROR', 'Missing inquiry id', 400); return; }
  const parsed = InquiryReplySchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const inquiry = await replyToInquiry(req.user!.id, inquiryId, parsed.data);
    ok(res, { inquiry });
  } catch (e) { handleError(res, e); }
});

// ── Blocked dates (vendor self-service) ──────────────────────────────────────

vendorsRouter.get('/blocked-dates', authenticate, async (req, res) => {
  const fromMonth = typeof req.query['fromMonth'] === 'string' ? req.query['fromMonth'] : undefined;
  try {
    const dates = await listBlockedDates(req.user!.id, fromMonth);
    ok(res, { dates });
  } catch (e) { handleError(res, e); }
});

vendorsRouter.post('/blocked-dates', authenticate, async (req, res) => {
  const parsed = BlockedDateSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const blocked = await addBlockedDate(req.user!.id, parsed.data);
    ok(res, { blocked }, 201);
  } catch (e) { handleError(res, e); }
});

vendorsRouter.delete('/blocked-dates/:id', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing id', 400); return; }
  try {
    await removeBlockedDate(req.user!.id, id);
    ok(res, { removed: true });
  } catch (e) { handleError(res, e); }
});

// ── POST /vendors/reviews/:reviewId/reply ────────────────────────────────────

vendorsRouter.post('/reviews/:reviewId/reply', authenticate, async (req, res) => {
  const reviewId = req.params['reviewId'];
  if (!reviewId) { err(res, 'VALIDATION_ERROR', 'Missing review id', 400); return; }
  const parsed = ReviewReplySchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const review = await replyToReview(req.user!.id, reviewId, parsed.data);
    ok(res, { review });
  } catch (e) { handleError(res, e); }
});

// ── GET /vendors/:id ─────────────────────────────────────────────────────────

vendorsRouter.get('/:id', async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  try {
    const vendor = await getVendor(id, req.user?.id);
    if (!vendor) { err(res, 'NOT_FOUND', 'Vendor not found', 404); return; }
    // Fire-and-forget view count (don't block response, ignore self-views by owner)
    if (!req.user || req.user.id) {
      void incrementViewCount(id).catch(() => {});
    }
    ok(res, vendor);
  } catch (e) { handleError(res, e, 'VENDOR_GET_ERROR'); }
});

// ── PATCH /vendors/:id ───────────────────────────────────────────────────────

vendorsRouter.patch('/:id', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  const parsed = VendorUpdateSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const vendor = await updateVendor(req.user!.id, id, parsed.data);
    ok(res, vendor);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update vendor';
    if (/access denied/i.test(msg)) { err(res, 'FORBIDDEN', msg, 403); return; }
    handleError(res, e, 'VENDOR_UPDATE_ERROR');
  }
});

// ── GET /vendors/:id/availability ────────────────────────────────────────────

vendorsRouter.get('/:id/availability', async (req, res) => {
  const { id } = req.params;
  const month = typeof req.query['month'] === 'string' ? req.query['month'] : undefined;

  if (!id) { err(res, 'VALIDATION_ERROR', 'Vendor id is required', 400); return; }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    err(res, 'VALIDATION_ERROR', 'month query param must be in YYYY-MM format', 400);
    return;
  }
  try {
    const result = await getAvailability(id, month);
    ok(res, result);
  } catch (e) { handleError(res, e, 'AVAILABILITY_ERROR'); }
});

// ── GET/POST /vendors/:id/reviews ────────────────────────────────────────────

vendorsRouter.get('/:id/reviews', async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  const page  = parseInt((req.query['page']  as string) ?? '1', 10) || 1;
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '20', 10) || 20, 50);
  try {
    const result = await listReviews(id, page, limit);
    ok(res, result);
  } catch (e) { handleError(res, e); }
});

vendorsRouter.post('/:id/reviews', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  const parsed = CreateReviewSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const review = await createReview(req.user!.id, id, parsed.data);
    ok(res, { review }, 201);
  } catch (e) { handleError(res, e); }
});

// ── POST /vendors/:id/inquiries ──────────────────────────────────────────────

vendorsRouter.post('/:id/inquiries', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  const parsed = CreateInquirySchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const inquiry = await createInquiry(req.user!.id, id, parsed.data);
    ok(res, { inquiry }, 201);
  } catch (e) { handleError(res, e); }
});

// ── POST/DELETE /vendors/:id/favorite ────────────────────────────────────────

vendorsRouter.post('/:id/favorite', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  try {
    const result = await addFavorite(req.user!.id, id);
    ok(res, result);
  } catch (e) { handleError(res, e); }
});

vendorsRouter.delete('/:id/favorite', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }
  try {
    const result = await removeFavorite(req.user!.id, id);
    ok(res, result);
  } catch (e) { handleError(res, e); }
});

// ── POST /vendors ────────────────────────────────────────────────────────────

vendorsRouter.post('/', authenticate, async (req, res) => {
  const parsed = CreateVendorSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const vendor = await createVendor(req.user!.id, parsed.data);
    ok(res, vendor, 201);
  } catch (e) { handleError(res, e, 'VENDOR_CREATE_ERROR'); }
});

// ── POST /vendors/:id/services ───────────────────────────────────────────────

vendorsRouter.post('/:id/services', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Vendor id is required', 400); return; }
  const parsed = CreateServiceSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const service = await addService(id, req.user!.id, parsed.data);
    ok(res, service, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/access denied/i.test(msg)) { err(res, 'FORBIDDEN', msg, 403); return; }
    handleError(res, e, 'SERVICE_CREATE_ERROR');
  }
});

// ── Vendor packages CRUD ─────────────────────────────────────────────────────
// GET    /vendors/:id/packages         (public)
// POST   /vendors/:id/packages         (auth, vendor owner)
// PUT    /vendors/:id/packages/:idx    (auth, vendor owner)
// DELETE /vendors/:id/packages/:idx    (auth, vendor owner)

const VendorPackageSchema = z.object({
  name:       z.string().min(1).max(120),
  price:      z.number().nonnegative().max(100_000_000),
  priceUnit:  z.string().min(1).max(40).default('PER_EVENT'),
  inclusions: z.array(z.string().min(1).max(280)).max(50).optional(),
  exclusions: z.array(z.string().min(1).max(280)).max(50).optional(),
  photoKeys:  z.array(z.string().min(1).max(500)).max(20).optional(),
});
type ParsedPackage = z.infer<typeof VendorPackageSchema>;
const _ensure: (p: ParsedPackage) => VendorPackage = (p) => p;
void _ensure;

function packageOwnerError(res: Response, e: unknown): boolean {
  const code = (e as { code?: string }).code;
  if (code === 'VENDOR_NOT_FOUND') { err(res, 'NOT_FOUND',  'Vendor not found', 404); return true; }
  if (code === 'FORBIDDEN')        { err(res, 'FORBIDDEN', 'Not vendor owner', 403); return true; }
  return false;
}

vendorsRouter.get('/:id/packages', async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Vendor id is required', 400); return; }
  try {
    const pkgs = await listVendorPackages(id);
    ok(res, { packages: pkgs });
  } catch (e) { handleError(res, e, 'VENDOR_PACKAGES_ERROR'); }
});

vendorsRouter.post('/:id/packages', authenticate, async (req, res) => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'Vendor id is required', 400); return; }
  const parsed = VendorPackageSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const pkgs = await addVendorPackage(id, req.user!.id, parsed.data);
    ok(res, { packages: pkgs }, 201);
  } catch (e) {
    if (packageOwnerError(res, e)) return;
    handleError(res, e, 'VENDOR_PACKAGE_ADD_ERROR');
  }
});

vendorsRouter.put('/:id/packages/:idx', authenticate, async (req, res) => {
  const id = req.params['id'];
  const idxRaw = req.params['idx'];
  const idx = idxRaw != null ? parseInt(idxRaw, 10) : NaN;
  if (!id || !Number.isInteger(idx) || idx < 0) {
    err(res, 'VALIDATION_ERROR', 'Vendor id and non-negative idx are required', 400); return;
  }
  const parsed = VendorPackageSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const pkgs = await updateVendorPackage(id, req.user!.id, idx, parsed.data);
    ok(res, { packages: pkgs });
  } catch (e) {
    if (packageOwnerError(res, e)) return;
    handleError(res, e, 'VENDOR_PACKAGE_UPDATE_ERROR');
  }
});

vendorsRouter.delete('/:id/packages/:idx', authenticate, async (req, res) => {
  const id = req.params['id'];
  const idxRaw = req.params['idx'];
  const idx = idxRaw != null ? parseInt(idxRaw, 10) : NaN;
  if (!id || !Number.isInteger(idx) || idx < 0) {
    err(res, 'VALIDATION_ERROR', 'Vendor id and non-negative idx are required', 400); return;
  }
  try {
    const pkgs = await removeVendorPackage(id, req.user!.id, idx);
    ok(res, { packages: pkgs });
  } catch (e) {
    if (packageOwnerError(res, e)) return;
    handleError(res, e, 'VENDOR_PACKAGE_DELETE_ERROR');
  }
});
