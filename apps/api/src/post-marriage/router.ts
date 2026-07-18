/**
 * Smart Shaadi — Post-Marriage Services Router (Phase 8, Unit 8.2)
 *
 * GET    /post-marriage/categories            → listCategories       (public)
 * GET    /post-marriage/services              → listServices         (public)
 * GET    /post-marriage/services/cities       → listServiceCities    (public)
 * GET    /post-marriage/enquiries/mine        → listMyEnquiries      (auth)
 * POST   /post-marriage/services/:id/enquiries → createEnquiry       (auth)
 * GET    /post-marriage/services/:slug        → getServiceBySlug     (public)
 *
 * Admin (all auth + ADMIN):
 * GET    /post-marriage/admin/enquiries       → triage queue
 * POST   /post-marriage/admin/enquiries/:id/reply → replyToEnquiry
 * POST   /post-marriage/admin/categories      → createCategory
 * PATCH  /post-marriage/admin/categories/:id  → updateCategory
 * DELETE /post-marriage/admin/categories/:id  → deactivateCategory
 * GET    /post-marriage/admin/partners        → listPartners
 * POST   /post-marriage/admin/partners        → createPartner
 * PATCH  /post-marriage/admin/partners/:id    → updatePartner
 * DELETE /post-marriage/admin/partners/:id    → deactivatePartner
 * POST   /post-marriage/admin/services        → createService
 * PATCH  /post-marriage/admin/services/:id    → updateService
 * DELETE /post-marriage/admin/services/:id    → deactivateService
 *
 * ROUTE ORDER MATTERS: `/services/cities` and `/services/:id/enquiries` are
 * declared BEFORE `/services/:slug`, or Express matches "cities" as a slug.
 */

import { Router, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  PostMarriageServiceListQuerySchema,
  CreatePostMarriageCategorySchema,
  UpdatePostMarriageCategorySchema,
  CreateServicePartnerSchema,
  UpdateServicePartnerSchema,
  CreatePostMarriageServiceSchema,
  UpdatePostMarriageServiceSchema,
  CreateServiceEnquirySchema,
  ReplyServiceEnquirySchema,
  ServiceEnquiryStatusSchema,
} from '@smartshaadi/schemas';
import {
  PostMarriageError,
  listCategories, createCategory, updateCategory, deactivateCategory,
  listServices, listServiceCities, getServiceBySlug,
  listPartnersForAdmin, createPartner, updatePartner, deactivatePartner,
  createService, updateService, deactivateService,
} from './service.js';
import {
  createServiceEnquiry,
  listMyServiceEnquiries,
  listAllServiceEnquiriesForAdmin,
  replyToServiceEnquiry,
} from './enquiries.service.js';

export const postMarriageRouter: Router = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND:        404,
  FORBIDDEN:        403,
  CONFLICT:         409,
  INVALID_STATE:    422,
  VALIDATION_ERROR: 400,
  INSERT_FAILED:    500,
};

function handleError(res: Response, e: unknown): void {
  if (e instanceof PostMarriageError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  console.error('[post-marriage] unhandled:', e);
  err(res, 'INTERNAL_ERROR', msg, 500);
}

function pageParams(req: { query: Record<string, unknown> }, defLimit: number, maxLimit: number) {
  const page  = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1,
    parseInt(String(req.query['limit'] ?? String(defLimit)), 10) || defLimit));
  return { page, limit };
}

// ── Public ───────────────────────────────────────────────────────────────────

postMarriageRouter.get('/categories', async (_req, res) => {
  try {
    ok(res, { categories: await listCategories() });
  } catch (e) {
    handleError(res, e);
  }
});

postMarriageRouter.get('/services/cities', async (_req, res) => {
  try {
    ok(res, { cities: await listServiceCities() });
  } catch (e) {
    handleError(res, e);
  }
});

postMarriageRouter.get('/services', async (req, res) => {
  const parsed = PostMarriageServiceListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await listServices(parsed.data);
    ok(res, result, 200, { total: result.total, page: result.page, limit: result.limit });
  } catch (e) {
    handleError(res, e);
  }
});

// ── Customer enquiries ───────────────────────────────────────────────────────

postMarriageRouter.get('/enquiries/mine', authenticate, async (req, res) => {
  try {
    const { page, limit } = pageParams(req, 20, 50);
    ok(res, await listMyServiceEnquiries(req.user!.id, page, limit));
  } catch (e) {
    handleError(res, e);
  }
});

postMarriageRouter.post('/services/:id/enquiries', authenticate, async (req, res) => {
  const parsed = CreateServiceEnquirySchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try {
    const enquiry = await createServiceEnquiry(
      req.user!.id, req.params['id'] as string, parsed.data,
    );
    ok(res, enquiry, 201);
  } catch (e) {
    handleError(res, e);
  }
});

// ── Admin ────────────────────────────────────────────────────────────────────

const adminOnly = [authenticate, authorize(['ADMIN'])] as const;

postMarriageRouter.get('/admin/enquiries', ...adminOnly, async (req, res) => {
  try {
    const { page, limit } = pageParams(req, 50, 100);
    const statusRaw = req.query['status'];
    const status = statusRaw
      ? ServiceEnquiryStatusSchema.safeParse(statusRaw)
      : undefined;
    if (status && !status.success) {
      err(res, 'VALIDATION_ERROR', 'Invalid status filter', 400);
      return;
    }
    ok(res, await listAllServiceEnquiriesForAdmin(status?.data, page, limit));
  } catch (e) {
    handleError(res, e);
  }
});

postMarriageRouter.post('/admin/enquiries/:id/reply', ...adminOnly, async (req, res) => {
  const parsed = ReplyServiceEnquirySchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try {
    ok(res, await replyToServiceEnquiry(req.params['id'] as string, parsed.data));
  } catch (e) {
    handleError(res, e);
  }
});

// Categories
postMarriageRouter.post('/admin/categories', ...adminOnly, async (req, res) => {
  const parsed = CreatePostMarriageCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try { ok(res, await createCategory(parsed.data), 201); } catch (e) { handleError(res, e); }
});

postMarriageRouter.patch('/admin/categories/:id', ...adminOnly, async (req, res) => {
  const parsed = UpdatePostMarriageCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try { ok(res, await updateCategory(req.params['id'] as string, parsed.data)); }
  catch (e) { handleError(res, e); }
});

postMarriageRouter.delete('/admin/categories/:id', ...adminOnly, async (req, res) => {
  try {
    await deactivateCategory(req.params['id'] as string);
    ok(res, { deactivated: true });
  } catch (e) { handleError(res, e); }
});

// Partners
postMarriageRouter.get('/admin/partners', ...adminOnly, async (req, res) => {
  try {
    const { page, limit } = pageParams(req, 50, 100);
    ok(res, await listPartnersForAdmin(page, limit));
  } catch (e) { handleError(res, e); }
});

postMarriageRouter.post('/admin/partners', ...adminOnly, async (req, res) => {
  const parsed = CreateServicePartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try { ok(res, await createPartner(parsed.data), 201); } catch (e) { handleError(res, e); }
});

postMarriageRouter.patch('/admin/partners/:id', ...adminOnly, async (req, res) => {
  const parsed = UpdateServicePartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try { ok(res, await updatePartner(req.params['id'] as string, parsed.data)); }
  catch (e) { handleError(res, e); }
});

postMarriageRouter.delete('/admin/partners/:id', ...adminOnly, async (req, res) => {
  try {
    await deactivatePartner(req.params['id'] as string);
    ok(res, { deactivated: true });
  } catch (e) { handleError(res, e); }
});

// Services
postMarriageRouter.post('/admin/services', ...adminOnly, async (req, res) => {
  const parsed = CreatePostMarriageServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try { ok(res, await createService(parsed.data), 201); } catch (e) { handleError(res, e); }
});

postMarriageRouter.patch('/admin/services/:id', ...adminOnly, async (req, res) => {
  const parsed = UpdatePostMarriageServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try { ok(res, await updateService(req.params['id'] as string, parsed.data)); }
  catch (e) { handleError(res, e); }
});

postMarriageRouter.delete('/admin/services/:id', ...adminOnly, async (req, res) => {
  try {
    await deactivateService(req.params['id'] as string);
    ok(res, { deactivated: true });
  } catch (e) { handleError(res, e); }
});

// ── Public detail (declared LAST — matches any remaining /services/* segment) ─

postMarriageRouter.get('/services/:slug', async (req, res) => {
  try {
    ok(res, await getServiceBySlug(req.params['slug'] as string));
  } catch (e) {
    handleError(res, e);
  }
});
