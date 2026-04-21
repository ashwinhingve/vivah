/**
 * Smart Shaadi — Admin Escrow Router
 *
 * Routes (all authenticated + ADMIN role required):
 *   GET  /disputes                    → getDisputedBookings
 *   PUT  /disputes/:bookingId/resolve → resolveDispute
 *
 * Phase 2 single agent will mount this at /api/v1/admin in apps/api/src/index.ts.
 */
import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { getDisputedBookings, resolveDispute } from '../payments/dispute.js';
import type { DisputeResolution } from '../payments/dispute.js';

export const escrowAdminRouter = Router();

// ── GET /admin/disputes — list all disputed bookings ──────────────────────────
escrowAdminRouter.get(
  '/disputes',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await getDisputedBookings(req.user!.id);
      ok(res, rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch disputed bookings';
      if (message.includes('Forbidden')) {
        err(res, 'FORBIDDEN', message, 403);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);

// ── PUT /admin/disputes/:bookingId/resolve — admin resolves dispute ───────────
escrowAdminRouter.put(
  '/disputes/:bookingId/resolve',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params['bookingId'];
    if (!bookingId) {
      err(res, 'VALIDATION_ERROR', 'Booking ID is required', 422);
      return;
    }

    const { resolution, splitRatio } = req.body as {
      resolution?: unknown;
      splitRatio?: unknown;
    };

    const validResolutions: DisputeResolution[] = ['RELEASE', 'REFUND', 'SPLIT'];
    if (!resolution || !validResolutions.includes(resolution as DisputeResolution)) {
      err(res, 'VALIDATION_ERROR', `resolution must be one of: ${validResolutions.join(', ')}`, 422);
      return;
    }

    if (resolution === 'SPLIT') {
      const ratio = typeof splitRatio === 'number' ? splitRatio : parseFloat(String(splitRatio));
      if (isNaN(ratio) || ratio <= 0 || ratio >= 1) {
        err(res, 'VALIDATION_ERROR', 'splitRatio must be a number between 0 and 1 (exclusive)', 422);
        return;
      }
    }

    try {
      const parsedRatio =
        typeof splitRatio === 'number'
          ? splitRatio
          : splitRatio !== undefined
            ? parseFloat(String(splitRatio))
            : undefined;

      const resolveBody =
        parsedRatio !== undefined
          ? { resolution: resolution as DisputeResolution, splitRatio: parsedRatio }
          : { resolution: resolution as DisputeResolution };

      const result = await resolveDispute(req.user!.id, bookingId, resolveBody);
      ok(res, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to resolve dispute';
      if (message.includes('Forbidden')) {
        err(res, 'FORBIDDEN', message, 403);
      } else if (message.includes('not found')) {
        err(res, 'NOT_FOUND', message, 404);
      } else if (message.includes('Invalid state') || message.includes('splitRatio')) {
        err(res, 'UNPROCESSABLE', message, 422);
      } else {
        err(res, 'INTERNAL', message, 500);
      }
    }
  },
);
