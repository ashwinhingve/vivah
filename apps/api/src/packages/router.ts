/**
 * Smart Shaadi — Premium Packages Router (Phase 8, Unit 8.1)
 *
 * GET    /packages                     → listPackages          (public)
 * GET    /packages/facets              → getFacets             (public)
 * GET    /packages/enquiries/mine      → listMyPackageEnquiries (auth)
 * GET    /packages/admin               → listAllForAdmin       (auth, ADMIN)
 * GET    /packages/admin/enquiries     → listAllEnquiries      (auth, ADMIN)
 * POST   /packages/admin               → createPackage         (auth, ADMIN)
 * PATCH  /packages/admin/:id           → updatePackage         (auth, ADMIN)
 * DELETE /packages/admin/:id           → deactivatePackage     (auth, ADMIN)
 * GET    /packages/:slug               → getPackageBySlug      (public)
 * POST   /packages/:id/enquiries       → createPackageEnquiry  (auth)
 * POST   /packages/:id/booking-check   → assertBookable        (auth)
 *
 * ROUTE ORDER MATTERS: the literal segments (`facets`, `admin`, `enquiries`)
 * are declared BEFORE `/:slug`, otherwise Express matches them as a slug and
 * the admin routes become unreachable behind a 404 from the public handler.
 */

import { Router, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  PremiumPackageListQuerySchema,
  CreatePremiumPackageSchema,
  UpdatePremiumPackageSchema,
  CreatePackageEnquirySchema,
} from '@smartshaadi/schemas';
import {
  PackageError,
  listPackages,
  getFacets,
  getPackageBySlug,
  createPackage,
  updatePackage,
  deactivatePackage,
  listAllPackagesForAdmin,
  assertBookable,
} from './service.js';
import {
  createPackageEnquiry,
  listMyPackageEnquiries,
  listAllPackageEnquiriesForAdmin,
} from './enquiries.service.js';

export const packagesRouter: Router = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND:         404,
  FORBIDDEN:         403,
  CONFLICT:          409,
  INVALID_STATE:     422,
  VALIDATION_ERROR:  400,
  INSERT_FAILED:     500,
  // 409 rather than 403: the request is well-formed and the caller is entitled
  // to make it — the RESOURCE is in a state that cannot accept it yet. A 403
  // would imply the user could fix it by authenticating differently.
  PLACEHOLDER_SUPPLY: 409,
};

function handlePackageError(res: Response, e: unknown): void {
  if (e instanceof PackageError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  console.error('[packages] unhandled:', e);
  err(res, 'INTERNAL_ERROR', msg, 500);
}

// ── Public browse ────────────────────────────────────────────────────────────

packagesRouter.get('/', async (req, res) => {
  const parsed = PremiumPackageListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await listPackages(parsed.data);
    ok(res, result, 200, { total: result.total, page: result.page, limit: result.limit });
  } catch (e) {
    handlePackageError(res, e);
  }
});

packagesRouter.get('/facets', async (_req, res) => {
  try {
    ok(res, await getFacets());
  } catch (e) {
    handlePackageError(res, e);
  }
});

// ── Customer enquiries ───────────────────────────────────────────────────────

packagesRouter.get('/enquiries/mine', authenticate, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));
    // Scoped to req.user.id — never a caller-supplied id (CLAUDE.md rule 2).
    ok(res, await listMyPackageEnquiries(req.user!.id, page, limit));
  } catch (e) {
    handlePackageError(res, e);
  }
});

// ── Admin ────────────────────────────────────────────────────────────────────

packagesRouter.get('/admin', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
    ok(res, await listAllPackagesForAdmin(page, limit));
  } catch (e) {
    handlePackageError(res, e);
  }
});

packagesRouter.get('/admin/enquiries', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
    ok(res, await listAllPackageEnquiriesForAdmin(page, limit));
  } catch (e) {
    handlePackageError(res, e);
  }
});

packagesRouter.post('/admin', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = CreatePremiumPackageSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try {
    ok(res, await createPackage(parsed.data), 201);
  } catch (e) {
    handlePackageError(res, e);
  }
});

packagesRouter.patch('/admin/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = UpdatePremiumPackageSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try {
    ok(res, await updatePackage(req.params['id'] as string, parsed.data));
  } catch (e) {
    handlePackageError(res, e);
  }
});

packagesRouter.delete('/admin/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    await deactivatePackage(req.params['id'] as string);
    ok(res, { deactivated: true });
  } catch (e) {
    handlePackageError(res, e);
  }
});

// ── Public detail (declared AFTER every literal segment) ─────────────────────

packagesRouter.get('/:slug', async (req, res) => {
  try {
    ok(res, await getPackageBySlug(req.params['slug'] as string));
  } catch (e) {
    handlePackageError(res, e);
  }
});

// ── Enquiry against a package ────────────────────────────────────────────────

packagesRouter.post('/:id/enquiries', authenticate, async (req, res) => {
  const parsed = CreatePackageEnquirySchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  try {
    const enquiry = await createPackageEnquiry(
      req.user!.id,
      req.params['id'] as string,
      parsed.data,
    );
    ok(res, enquiry, 201);
  } catch (e) {
    handlePackageError(res, e);
  }
});

/**
 * Pre-flight for the booking path: 200 if this package may have money raised
 * against it, 409 PLACEHOLDER_SUPPLY if it is preview inventory.
 *
 * Exposed as its own endpoint so the web layer can decide which CTA to render
 * WITHOUT reimplementing the rule — the client asks the server rather than
 * reading `isPlaceholder` and drawing its own conclusion. The real booking flow
 * calls `assertBookable()` again server-side; this endpoint is a convenience,
 * never the enforcement point.
 */
packagesRouter.post('/:id/booking-check', authenticate, async (req, res) => {
  try {
    const pkg = await assertBookable(req.params['id'] as string);
    ok(res, { bookable: true, packageId: pkg.id, priceFrom: pkg.priceFrom });
  } catch (e) {
    handlePackageError(res, e);
  }
});
