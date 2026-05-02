/**
 * Smart Shaadi — Payments Router
 *
 * Routes:
 *   POST /payments/order             → createPaymentOrder  (authenticated)
 *   GET  /payments/history           → getPaymentHistory   (authenticated)
 *   POST /payments/refund/:id        → requestRefund       (authenticated)
 *   GET  /payments/escrow/:bookingId → getEscrowStatus     (authenticated)
 *
 * POST /payments/webhook is registered directly in index.ts so it runs
 * before express.json() (needs raw body for HMAC verification).
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { authorizeBookingAccess } from '../lib/bookingAccess.js';
import { CreatePaymentOrderSchema, RefundSchema, RetryPaymentSchema } from '@smartshaadi/schemas';
import {
  createPaymentOrder,
  getPaymentHistory,
  requestRefund,
  getEscrowStatus,
  retryPaymentOrder,
} from './service.js';

export const paymentsRouter = Router();

// ---------------------------------------------------------------------------
// POST /payments/order — create Razorpay order for confirmed booking
// ---------------------------------------------------------------------------
paymentsRouter.post(
  '/order',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parse = CreatePaymentOrderSchema.safeParse(req.body);
    if (!parse.success) {
      err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }

    try {
      const order = await createPaymentOrder(req.user!.id, parse.data);
      ok(res, order, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create payment order';
      if (message.includes('Forbidden')) {
        err(res, 'FORBIDDEN', message, 403);
      } else if (message.includes('not found')) {
        err(res, 'NOT_FOUND', message, 404);
      } else if (message.includes('CONFIRMED')) {
        err(res, 'UNPROCESSABLE', message, 422);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);

// ---------------------------------------------------------------------------
// GET /payments/history — paginated payment history
// ---------------------------------------------------------------------------
paymentsRouter.get(
  '/history',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const page  = Math.max(1, parseInt(req.query['page']  as string ?? '1',  10) || 1);
    const limit = Math.min(50, parseInt(req.query['limit'] as string ?? '10', 10) || 10);

    try {
      const result = await getPaymentHistory(req.user!.id, page, limit);
      ok(res, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch payment history';
      err(res, 'INTERNAL', message, 500);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /payments/refund/:id — request refund for a payment
// ---------------------------------------------------------------------------
paymentsRouter.post(
  '/refund/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const paymentId = req.params['id'];
    if (!paymentId) {
      err(res, 'VALIDATION_ERROR', 'Payment ID is required', 422);
      return;
    }

    const parse = RefundSchema.safeParse(req.body);
    if (!parse.success) {
      err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }

    try {
      await requestRefund(req.user!.id, paymentId, parse.data);
      ok(res, { refunded: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process refund';
      if (message.includes('forbidden') || message.includes('not found')) {
        err(res, 'FORBIDDEN', message, 403);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);

// ---------------------------------------------------------------------------
// POST /payments/retry — recreate Razorpay order after a failed attempt
// ---------------------------------------------------------------------------
paymentsRouter.post(
  '/retry',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parse = RetryPaymentSchema.safeParse(req.body);
    if (!parse.success) {
      err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }
    try {
      const order = await retryPaymentOrder(req.user!.id, parse.data.bookingId);
      ok(res, order, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Retry failed';
      if (message.includes('Forbidden')) err(res, 'FORBIDDEN', message, 403);
      else if (message.includes('not found')) err(res, 'NOT_FOUND', message, 404);
      else if (message.includes('CONFIRMED') || message.includes('already captured')) err(res, 'UNPROCESSABLE', message, 422);
      else err(res, 'INTERNAL', message, 500);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /payments/escrow/:bookingId — get escrow status for a booking
// ---------------------------------------------------------------------------
paymentsRouter.get(
  '/escrow/:bookingId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['bookingId'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Booking ID is required', 422);
      return;
    }

    const access = await authorizeBookingAccess(bookingId, req.user!.id, req.user!.role);
    if (!access.ok) {
      err(res, access.code, access.message, access.status);
      return;
    }

    try {
      const escrow = await getEscrowStatus(bookingId);
      ok(res, escrow);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch escrow status';
      err(res, 'INTERNAL', message, 500);
    }
  },
);
