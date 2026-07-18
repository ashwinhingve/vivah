/**
 * Multi-City Vendor Network (Unit 6.5, Sprint J) — HTTP routers.
 *
 * Routes:
 *   ADMIN (mounted at /api/v1/admin/cities):
 *     GET    /                 network overview
 *     GET    /:id/density      city density report
 *     PATCH  /:id              update city
 *     POST   /                 create city
 *
 *   PUBLIC (mounted at /api/v1/cities):
 *     GET    /                 list ACTIVE cities only
 */

import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { registerUuidParams } from '../middleware/validateUuidParams.js';
import {
  listCities,
  updateCity,
  createCity,
  getCityDensity,
  getNetworkOverview,
  CityNotFoundError,
  CitySlugConflictError,
} from './service.js';
import { UpdateCitySchema, CreateCitySchema } from '@smartshaadi/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTER — registered at /api/v1/admin/cities
// ─────────────────────────────────────────────────────────────────────────────

export const citiesAdminRouter = Router();
registerUuidParams(citiesAdminRouter, 'id');

/**
 * GET /admin/cities — network overview with per-city metrics.
 */
citiesAdminRouter.get(
  '/',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const overview = await getNetworkOverview();
      ok(res, overview);
    } catch (e) {
      console.error('[cities] Error fetching network overview:', e);
      err(res, 'INTERNAL_ERROR', 'Failed to fetch network overview', 500);
    }
  },
);

/**
 * GET /admin/cities/:id/density — density report for a single city.
 */
citiesAdminRouter.get(
  '/:id/density',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const density = await getCityDensity(req.params.id!);
      ok(res, density);
    } catch (e) {
      if (e instanceof CityNotFoundError) {
        err(res, 'NOT_FOUND', e.message, 404);
      } else {
        console.error('[cities] Error fetching density:', e);
        err(res, 'INTERNAL_ERROR', 'Failed to fetch density', 500);
      }
    }
  },
);

/**
 * PATCH /admin/cities/:id — update city fields.
 */
citiesAdminRouter.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = UpdateCitySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.message, 400);
      return;
    }

    try {
      const updated = await updateCity(req.params.id!, parsed.data);
      ok(res, updated);
    } catch (e) {
      if (e instanceof CityNotFoundError) {
        err(res, 'NOT_FOUND', e.message, 404);
      } else {
        console.error('[cities] Error updating city:', e);
        err(res, 'INTERNAL_ERROR', 'Failed to update city', 500);
      }
    }
  },
);

/**
 * POST /admin/cities — create a new city.
 */
citiesAdminRouter.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const parsed = CreateCitySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.message, 400);
      return;
    }

    try {
      const created = await createCity(parsed.data);
      ok(res, created, 201);
    } catch (e) {
      if (e instanceof CitySlugConflictError) {
        err(res, 'CONFLICT', e.message, 409);
      } else {
        console.error('[cities] Error creating city:', e);
        err(res, 'INTERNAL_ERROR', 'Failed to create city', 500);
      }
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTER — registered at /api/v1/cities
// ─────────────────────────────────────────────────────────────────────────────

export const citiesPublicRouter = Router();

/**
 * GET /cities — list ACTIVE cities only (no auth required).
 * Returns: { id, name, slug, state } for frontend city filters.
 */
citiesPublicRouter.get(
  '/',
  async (_req: Request, res: Response) => {
    try {
      const all = await listCities();
      // Filter to ACTIVE cities only; return minimal fields.
      const active = all
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          state: c.state,
        }));
      ok(res, active);
    } catch (e) {
      console.error('[cities] Error fetching active cities:', e);
      err(res, 'INTERNAL_ERROR', 'Failed to fetch cities', 500);
    }
  },
);
