import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { authorizeBookingAccess } from '../lib/bookingAccess.js';
import { addSplit, listSplits, releaseSplit, disputeSplit } from './paymentSplits.js';

export const paymentSplitsRouter = Router();

// GET /payments/bookings/:bookingId/splits
paymentSplitsRouter.get(
  '/bookings/:bookingId/splits',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = req.params;
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
      const splits = await listSplits(bookingId);
      ok(res, splits);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to list splits';
      err(res, 'INTERNAL', message, 500);
    }
  },
);

// POST /payments/bookings/:bookingId/splits
paymentSplitsRouter.post(
  '/bookings/:bookingId/splits',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = req.params;
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Booking ID is required', 422);
      return;
    }

    const { paymentId, vendorId, amount, platformFee } = req.body as {
      paymentId?:  string;
      vendorId:    string;
      amount:      number;
      platformFee: number;
    };

    if (!vendorId || amount === undefined || amount === null) {
      err(res, 'VALIDATION_ERROR', 'vendorId and amount are required', 422);
      return;
    }

    try {
      const split = await addSplit({
        bookingId,
        ...(paymentId ? { paymentId } : {}),
        vendorId,
        amount,
        platformFee: platformFee ?? 0,
      });
      ok(res, split, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to add split';
      if (message.includes('not found')) {
        err(res, 'NOT_FOUND', message, 404);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);

// POST /payments/splits/:id/release
paymentSplitsRouter.post(
  '/splits/:id/release',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const splitId = req.params['id'];
    if (!splitId) {
      err(res, 'VALIDATION_ERROR', 'Split ID is required', 422);
      return;
    }
    try {
      const split = await releaseSplit(splitId);
      ok(res, split);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to release split';
      if (message.includes('not found')) {
        err(res, 'NOT_FOUND', message, 404);
      } else if (message.includes('Cannot') || message.includes('already')) {
        err(res, 'INVALID_STATE', message, 409);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);

// POST /payments/splits/:id/dispute
paymentSplitsRouter.post(
  '/splits/:id/dispute',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const splitId = req.params['id'];
    if (!splitId) {
      err(res, 'VALIDATION_ERROR', 'Split ID is required', 422);
      return;
    }
    try {
      const split = await disputeSplit(splitId);
      ok(res, split);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to dispute split';
      if (message.includes('not found')) {
        err(res, 'NOT_FOUND', message, 404);
      } else if (message.includes('Cannot') || message.includes('already')) {
        err(res, 'INVALID_STATE', message, 409);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);
