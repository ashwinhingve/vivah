/**
 * Bookings REST router.
 *
 * POST   /bookings                → createBooking
 * GET    /bookings                → getBookings (?role=customer|vendor)
 * GET    /bookings/:id            → getBooking
 * PUT    /bookings/:id/confirm    → confirmBooking
 * PUT    /bookings/:id/cancel     → cancelBooking
 * PUT    /bookings/:id/complete   → completeBooking
 * GET    /bookings/:id/invoice    → download PDF invoice
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import { bookings, vendors, vendorServices } from '@smartshaadi/db';
import { CreateBookingSchema } from '@smartshaadi/schemas';
import { generateInvoice } from './invoice.js';
import {
  createBooking,
  confirmBooking,
  cancelBooking,
  completeBooking,
  getBookings,
  getBooking,
  BookingError,
} from './service.js';

export const bookingsRouter = Router();

// ── Error handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown): void {
  if (error instanceof BookingError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND:        404,
      FORBIDDEN:        403,
      BOOKING_CONFLICT: 409,
      INVALID_STATE:    422,
    };
    const status = statusMap[error.code] ?? 400;
    err(res, error.code, error.message, status);
    return;
  }
  err(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

// ── POST /bookings ─────────────────────────────────────────────────────────────

bookingsRouter.post(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }

    const customerId = req.user!.id;

    try {
      const booking = await createBooking(customerId, parsed.data);
      ok(res, { booking }, 201);
    } catch (error) {
      handleError(res, error);
    }
  },
);

// ── GET /bookings ─────────────────────────────────────────────────────────────

const BookingListQuery = z.object({
  role:  z.enum(['customer', 'vendor']).default('customer'),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

bookingsRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = BookingListQuery.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }

    const userId = req.user!.id;
    const { role, page, limit } = parsed.data;

    try {
      const result = await getBookings(userId, role, page, limit);
      ok(res, result);
    } catch (error) {
      handleError(res, error);
    }
  },
);

// ── GET /bookings/:id ─────────────────────────────────────────────────────────

bookingsRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Missing booking id', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const booking = await getBooking(userId, bookingId);
      ok(res, { booking });
    } catch (error) {
      handleError(res, error);
    }
  },
);

// ── PUT /bookings/:id/confirm ─────────────────────────────────────────────────

bookingsRouter.put(
  '/:id/confirm',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Missing booking id', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const booking = await confirmBooking(userId, bookingId);
      ok(res, { booking });
    } catch (error) {
      handleError(res, error);
    }
  },
);

// ── PUT /bookings/:id/cancel ──────────────────────────────────────────────────

const CancelBody = z.object({
  reason: z.string().max(500).optional(),
});

bookingsRouter.put(
  '/:id/cancel',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Missing booking id', 400);
      return;
    }

    const parsed = CancelBody.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const booking = await cancelBooking(userId, bookingId, parsed.data.reason);
      ok(res, { booking });
    } catch (error) {
      handleError(res, error);
    }
  },
);

// ── PUT /bookings/:id/complete ────────────────────────────────────────────────

bookingsRouter.put(
  '/:id/complete',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Missing booking id', 400);
      return;
    }

    try {
      const booking = await completeBooking(req.user!.id, bookingId);
      ok(res, { booking });
    } catch (error) {
      handleError(res, error);
    }
  },
);

// ── GET /bookings/:id/invoice ─────────────────────────────────────────────────

bookingsRouter.get(
  '/:id/invoice',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['id'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Missing booking id', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      // Verify access and get full booking detail
      const bookingDetail = await getBooking(userId, bookingId);

      // Fetch raw row for customer and additional data
      const [rawBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (!rawBooking) {
        err(res, 'NOT_FOUND', 'Booking not found', 404);
        return;
      }

      // Get service name if serviceId present
      const serviceNames: string[] = [];
      if (rawBooking.serviceId) {
        const [svc] = await db
          .select({ name: vendorServices.name })
          .from(vendorServices)
          .where(eq(vendorServices.id, rawBooking.serviceId))
          .limit(1);
        if (svc) serviceNames.push(svc.name);
      }

      if (serviceNames.length === 0) {
        serviceNames.push('Wedding Services');
      }

      // Get vendor info
      const [vendor] = await db
        .select({ businessName: vendors.businessName })
        .from(vendors)
        .where(eq(vendors.id, rawBooking.vendorId))
        .limit(1);

      const invoiceNo = `INV-${rawBooking.id.slice(0, 8).toUpperCase()}`;

      const pdfBuffer = await generateInvoice({
        bookingId:    rawBooking.id,
        customerName: req.user!.name || 'Valued Customer',
        vendorName:   vendor?.businessName ?? bookingDetail.vendorName,
        serviceNames,
        eventDate:    rawBooking.eventDate,
        totalAmount:  bookingDetail.totalAmount,
        paidAmount:   bookingDetail.escrowAmount ?? 0,
        invoiceDate:  new Date().toLocaleDateString('en-IN'),
        invoiceNo,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${bookingId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      handleError(res, error);
    }
  },
);
