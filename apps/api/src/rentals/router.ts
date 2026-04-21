/**
 * Smart Shaadi — Rental Router
 *
 * GET    /                      → listRentalItems   (PUBLIC)
 * GET    /bookings/mine         → getMyRentalBookings (authenticate) ← must be BEFORE /:id
 * GET    /:id                   → getRentalItem     (PUBLIC)
 * POST   /                      → createRentalItem  (authenticate)
 * POST   /:id/book              → createRentalBooking (authenticate)
 * PUT    /bookings/:id/confirm  → confirmRentalBooking (authenticate)
 * PUT    /bookings/:id/return   → returnRentalItem  (authenticate)
 *
 * Exported as `rentalRouter`. Phase 2 mounts at /api/v1/rentals.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  RentalListQuerySchema,
  CreateRentalItemSchema,
  CreateRentalBookingSchema,
} from '@smartshaadi/schemas';
import {
  listRentalItems,
  getRentalItem,
  createRentalItem,
  createRentalBooking,
  confirmRentalBooking,
  returnRentalItem,
  getMyRentalBookings,
} from './service.js';

export const rentalRouter = Router();

// ── Error handler ─────────────────────────────────────────────────────────────

interface AppError extends Error {
  code?:   string;
  status?: number;
}

function handleError(res: Response, e: unknown, fallbackMsg: string): void {
  const ae     = e as AppError;
  const code   = ae.code   ?? 'INTERNAL_ERROR';
  const status = ae.status ?? 500;
  const msg    = ae instanceof Error ? ae.message : fallbackMsg;

  if (status === 403) { err(res, 'FORBIDDEN',   msg, 403); return; }
  if (status === 404) { err(res, 'NOT_FOUND',   msg, 404); return; }
  if (status === 409) { err(res, code,           msg, 409); return; }
  err(res, code, msg, status);
}

// ── GET / — list rental items (PUBLIC) ────────────────────────────────────────

rentalRouter.get(
  '/',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RentalListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }

    try {
      const result = await listRentalItems(parsed.data);
      ok(res, result);
    } catch (e) {
      handleError(res, e, 'Failed to list rental items');
    }
  },
);

// ── GET /bookings/mine — MUST be declared before /:id ─────────────────────────

rentalRouter.get(
  '/bookings/mine',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    try {
      const bookings = await getMyRentalBookings(userId);
      ok(res, { bookings });
    } catch (e) {
      handleError(res, e, 'Failed to fetch your rental bookings');
    }
  },
);

// ── GET /:id — get rental item detail (PUBLIC) ────────────────────────────────

rentalRouter.get(
  '/:id',
  async (req: Request, res: Response): Promise<void> => {
    const itemId = req.params['id'];
    if (!itemId) { err(res, 'VALIDATION_ERROR', 'Missing item id', 400); return; }

    try {
      const item = await getRentalItem(itemId);
      ok(res, item);
    } catch (e) {
      handleError(res, e, 'Failed to fetch rental item');
    }
  },
);

// ── POST / — create rental item (authenticate; vendor ownership checked in service) ─

rentalRouter.post(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const parsed = CreateRentalItemSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const item = await createRentalItem(userId, parsed.data);
      ok(res, item, 201);
    } catch (e) {
      handleError(res, e, 'Failed to create rental item');
    }
  },
);

// ── POST /:id/book — create booking (authenticate) ───────────────────────────

rentalRouter.post(
  '/:id/book',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const itemId = req.params['id'];
    const userId = req.user!.id;
    if (!itemId) { err(res, 'VALIDATION_ERROR', 'Missing item id', 400); return; }

    // Merge itemId from URL into body for schema validation
    const body = { ...req.body, rentalItemId: itemId };
    const parsed = CreateRentalBookingSchema.safeParse(body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const booking = await createRentalBooking(userId, parsed.data);
      ok(res, booking, 201);
    } catch (e) {
      handleError(res, e, 'Failed to create rental booking');
    }
  },
);

// ── PUT /bookings/:id/confirm (authenticate) ──────────────────────────────────

rentalRouter.put(
  '/bookings/:id/confirm',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    const userId    = req.user!.id;
    if (!bookingId) { err(res, 'VALIDATION_ERROR', 'Missing booking id', 400); return; }

    try {
      const booking = await confirmRentalBooking(userId, bookingId);
      ok(res, booking);
    } catch (e) {
      handleError(res, e, 'Failed to confirm rental booking');
    }
  },
);

// ── PUT /bookings/:id/return (authenticate) ───────────────────────────────────

rentalRouter.put(
  '/bookings/:id/return',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    const userId    = req.user!.id;
    if (!bookingId) { err(res, 'VALIDATION_ERROR', 'Missing booking id', 400); return; }

    try {
      const booking = await returnRentalItem(userId, bookingId);
      ok(res, booking);
    } catch (e) {
      handleError(res, e, 'Failed to mark booking as returned');
    }
  },
);
