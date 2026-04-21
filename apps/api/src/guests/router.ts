/**
 * Smart Shaadi — Guest Router
 *
 * GET    /weddings/:id/guests              → getGuestList        (authenticate)
 * POST   /weddings/:id/guests              → addGuest            (authenticate)
 * POST   /weddings/:id/guests/bulk         → bulkImportGuests    (authenticate)
 * PUT    /weddings/:id/guests/:guestId     → updateGuest         (authenticate)
 * DELETE /weddings/:id/guests/:guestId     → deleteGuest         (authenticate)
 * POST   /weddings/:id/invitations/send    → sendInvitations     (authenticate)
 * GET    /weddings/:id/guests/stats        → getRsvpStats        (authenticate)
 * PUT    /rsvp/:token                      → updateRsvp          (NO AUTH — public token endpoint)
 *
 * Exported as `guestRouter`. Phase 2 mounts at /api/v1.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  AddGuestSchema,
  BulkImportGuestsSchema,
  UpdateGuestSchema,
  RsvpUpdateSchema,
  SendInvitationsSchema,
} from '@smartshaadi/schemas';
import {
  getGuestList,
  addGuest,
  bulkImportGuests,
  updateGuest,
  deleteGuest,
  updateRsvp,
  getRsvpStats,
} from './service.js';
import { sendInvitations } from './invitation.js';

export const guestRouter = Router();

// ── Helper: extract error code and status from thrown errors ──────────────────

interface AppError extends Error {
  code?:   string;
  status?: number;
}

function handleError(res: Response, e: unknown, fallbackMsg: string): void {
  const ae = e as AppError;
  const code   = ae.code   ?? 'INTERNAL_ERROR';
  const status = ae.status ?? 500;
  const msg    = ae instanceof Error ? ae.message : fallbackMsg;

  if (status === 403) { err(res, 'FORBIDDEN',  msg, 403); return; }
  if (status === 404) { err(res, 'NOT_FOUND',  msg, 404); return; }
  err(res, code, msg, status);
}

// ── GET /weddings/:id/guests ──────────────────────────────────────────────────

guestRouter.get(
  '/weddings/:id/guests',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const userId    = req.user!.id;
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    try {
      const guestList = await getGuestList(weddingId, userId);
      ok(res, { guests: guestList });
    } catch (e) {
      handleError(res, e, 'Failed to fetch guest list');
    }
  },
);

// ── GET /weddings/:id/guests/stats ────────────────────────────────────────────
// Must be declared BEFORE /:guestId routes to avoid route shadowing

guestRouter.get(
  '/weddings/:id/guests/stats',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const userId    = req.user!.id;
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    try {
      const stats = await getRsvpStats(weddingId, userId);
      ok(res, stats);
    } catch (e) {
      handleError(res, e, 'Failed to fetch RSVP stats');
    }
  },
);

// ── POST /weddings/:id/guests ─────────────────────────────────────────────────

guestRouter.post(
  '/weddings/:id/guests',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const userId    = req.user!.id;
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = AddGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const guest = await addGuest(weddingId, userId, parsed.data);
      ok(res, guest, 201);
    } catch (e) {
      handleError(res, e, 'Failed to add guest');
    }
  },
);

// ── POST /weddings/:id/guests/bulk ────────────────────────────────────────────

guestRouter.post(
  '/weddings/:id/guests/bulk',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const userId    = req.user!.id;
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = BulkImportGuestsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const result = await bulkImportGuests(weddingId, userId, parsed.data);
      ok(res, result, 201);
    } catch (e) {
      handleError(res, e, 'Failed to bulk import guests');
    }
  },
);

// ── PUT /weddings/:id/guests/:guestId ─────────────────────────────────────────

guestRouter.put(
  '/weddings/:id/guests/:guestId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const guestId   = req.params['guestId'];
    const userId    = req.user!.id;
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing wedding or guest id', 400); return; }

    const parsed = UpdateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const guest = await updateGuest(weddingId, guestId, userId, parsed.data);
      ok(res, guest);
    } catch (e) {
      handleError(res, e, 'Failed to update guest');
    }
  },
);

// ── DELETE /weddings/:id/guests/:guestId ──────────────────────────────────────

guestRouter.delete(
  '/weddings/:id/guests/:guestId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const guestId   = req.params['guestId'];
    const userId    = req.user!.id;
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing wedding or guest id', 400); return; }

    try {
      await deleteGuest(weddingId, guestId, userId);
      ok(res, { deleted: true });
    } catch (e) {
      handleError(res, e, 'Failed to delete guest');
    }
  },
);

// ── POST /weddings/:id/invitations/send ───────────────────────────────────────

guestRouter.post(
  '/weddings/:id/invitations/send',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = req.params['id'];
    const userId    = req.user!.id;
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = SendInvitationsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    // Verify wedding ownership before sending invitations
    try {
      // Import ownership check inline — service helper not exported, so we do a lightweight check
      const { getGuestList: _gl } = await import('./service.js');
      await _gl(weddingId, userId); // will throw 403/404 if not owner

      const result = await sendInvitations(weddingId, parsed.data);
      ok(res, result);
    } catch (e) {
      handleError(res, e, 'Failed to send invitations');
    }
  },
);

// ── PUT /rsvp/:token — PUBLIC (no authenticate) ───────────────────────────────

guestRouter.put(
  '/rsvp/:token',
  async (req: Request, res: Response): Promise<void> => {
    const token = req.params['token'];
    if (!token) { err(res, 'VALIDATION_ERROR', 'Missing RSVP token', 400); return; }

    const parsed = RsvpUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const guest = await updateRsvp(token, parsed.data);
      ok(res, guest);
    } catch (e) {
      handleError(res, e, 'Failed to update RSVP');
    }
  },
);
