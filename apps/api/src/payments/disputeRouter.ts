/**
 * Smart Shaadi — Dispute Router (NEW FILE — not modifying frozen router.ts)
 *
 * Routes:
 *   POST /:bookingId/dispute → raiseDispute (authenticated customer)
 *
 * Phase 2 single agent will mount this at /api/v1/payments in apps/api/src/index.ts.
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { DisputeEscrowSchema } from '@smartshaadi/schemas';
import { raiseDispute } from './dispute.js';

export const disputeRouter = Router();

// POST /payments/:bookingId/dispute — customer raises a dispute
disputeRouter.post(
  '/:bookingId/dispute',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['bookingId'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Booking ID is required', 422);
      return;
    }

    const parse = DisputeEscrowSchema.safeParse(req.body);
    if (!parse.success) {
      err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }

    try {
      const result = await raiseDispute(req.user!.id, bookingId, parse.data);
      ok(res, result, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to raise dispute';
      if (message.includes('Forbidden')) {
        err(res, 'FORBIDDEN', message, 403);
      } else if (message.includes('not found')) {
        err(res, 'NOT_FOUND', message, 404);
      } else if (message.includes('Invalid state')) {
        err(res, 'UNPROCESSABLE', message, 422);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);
