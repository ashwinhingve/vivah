/**
 * Smart Shaadi — Vendors Router
 *
 * GET  /vendors                      → listVendors  (public)
 * GET  /vendors/:id                  → getVendor    (public)
 * GET  /vendors/:id/availability     → getAvailability (public) ?month=YYYY-MM
 * POST /vendors                      → createVendor (authenticated)
 * POST /vendors/:id/services         → addService   (authenticated, vendor owner)
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { VendorListQuerySchema, CreateVendorSchema, CreateServiceSchema } from '@smartshaadi/schemas';
import {
  listVendors,
  getVendor,
  createVendor,
  addService,
  getAvailability,
} from './service.js';

export const vendorsRouter = Router();

// ── GET /vendors ───────────────────────────────────────────────────────────────

vendorsRouter.get(
  '/',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = VendorListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }

    try {
      const result = await listVendors(parsed.data);
      ok(res, result, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to list vendors';
      err(res, 'VENDOR_LIST_ERROR', message, 500);
    }
  },
);

// ── GET /vendors/:id ───────────────────────────────────────────────────────────

vendorsRouter.get(
  '/:id',
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing vendor id', 400); return; }

    try {
      const vendor = await getVendor(id);
      if (!vendor) {
        err(res, 'NOT_FOUND', 'Vendor not found', 404);
        return;
      }
      ok(res, vendor);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get vendor';
      err(res, 'VENDOR_GET_ERROR', message, 500);
    }
  },
);

// ── GET /vendors/:id/availability ─────────────────────────────────────────────

vendorsRouter.get(
  '/:id/availability',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const month = typeof req.query['month'] === 'string' ? req.query['month'] : undefined;

    if (!id) {
      err(res, 'VALIDATION_ERROR', 'Vendor id is required', 400);
      return;
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      err(res, 'VALIDATION_ERROR', 'month query param must be in YYYY-MM format', 400);
      return;
    }

    try {
      const dates = await getAvailability(id, month);
      ok(res, { bookedDates: dates });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get availability';
      err(res, 'AVAILABILITY_ERROR', message, 500);
    }
  },
);

// ── POST /vendors ──────────────────────────────────────────────────────────────

vendorsRouter.post(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateVendorSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const vendor = await createVendor(userId, parsed.data);
      ok(res, vendor, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create vendor';
      err(res, 'VENDOR_CREATE_ERROR', message, 500);
    }
  },
);

// ── POST /vendors/:id/services ─────────────────────────────────────────────────

vendorsRouter.post(
  '/:id/services',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) {
      err(res, 'VALIDATION_ERROR', 'Vendor id is required', 400);
      return;
    }

    const parsed = CreateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const service = await addService(id, userId, parsed.data);
      ok(res, service, 201);
    } catch (e) {
      if (e instanceof Error && e.message.includes('access denied')) {
        err(res, 'FORBIDDEN', e.message, 403);
        return;
      }
      const message = e instanceof Error ? e.message : 'Failed to add service';
      err(res, 'SERVICE_CREATE_ERROR', message, 500);
    }
  },
);
