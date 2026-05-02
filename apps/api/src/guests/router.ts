/**
 * Smart Shaadi — Guest Router
 *
 * GET    /weddings/:id/guests                                → getGuestList
 * GET    /weddings/:id/guests/stats                          → getRsvpStats
 * GET    /weddings/:id/guests/analytics                      → getRsvpAnalytics
 * GET    /weddings/:id/guests/export.csv                     → CSV download
 * POST   /weddings/:id/guests/import-csv                     → CSV bulk import
 * GET    /weddings/:id/guests/:guestId                       → getGuestRich
 * POST   /weddings/:id/guests                                → addGuest
 * POST   /weddings/:id/guests/bulk                           → bulkImportGuests
 * PUT    /weddings/:id/guests/:guestId                       → updateGuest (rich)
 * DELETE /weddings/:id/guests/:guestId                       → deleteGuest
 * POST   /weddings/:id/guests/:guestId/check-in              → checkInGuest
 * GET/PUT /weddings/:id/guests/:guestId/address              → guest address
 * GET/PUT /weddings/:id/guests/:guestId/ceremony-prefs       → per-ceremony prefs
 * POST   /weddings/:id/invitations/send                      → sendInvitations
 * GET/POST /weddings/:id/rsvp-questions                      → list/create custom Qs
 * PUT/DELETE /weddings/:id/rsvp-questions/:qId               → update/delete custom Q
 * GET/PUT  /weddings/:id/rsvp-deadline                       → deadline config
 * PUT    /rsvp/:token                                         → updateRsvp (PUBLIC)
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  AddGuestSchema,
  BulkImportGuestsSchema,
  RichUpdateGuestSchema,
  RsvpUpdateSchema,
  SendInvitationsSchema,
  CsvImportGuestsSchema,
  CheckInGuestSchema,
  AddRsvpQuestionSchema,
  UpdateRsvpQuestionSchema,
  UpsertGuestAddressSchema,
  UpsertCeremonyPrefsSchema,
  UpsertRsvpDeadlineSchema,
} from '@smartshaadi/schemas';
import {
  getGuestList,
  getGuestRich,
  addGuest,
  bulkImportGuests,
  updateGuest,
  deleteGuest,
  updateRsvp,
  getRsvpStats,
  checkInGuest,
} from './service.js';
import { sendInvitations } from './invitation.js';
import { exportGuestsToCsv, parseGuestCsv } from './csvService.js';
import { getRsvpAnalytics } from './analyticsService.js';
import {
  getGuestAddress, upsertGuestAddress,
  getGuestCeremonyPrefs, upsertGuestCeremonyPrefs,
  listRsvpQuestions, addRsvpQuestion, updateRsvpQuestion, deleteRsvpQuestion,
  getRsvpDeadline, upsertRsvpDeadline,
} from './extraServices.js';

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
  if (status === 410) { err(res, code,         msg, 410); return; }
  err(res, code, msg, status);
}

function reqId(req: Request, key: string): string | null {
  const v = req.params[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

// ── GET /weddings/:id/guests ──────────────────────────────────────────────────

guestRouter.get(
  '/weddings/:id/guests',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const guestList = await getGuestList(weddingId, req.user!.id);
      ok(res, { guests: guestList });
    } catch (e) {
      handleError(res, e, 'Failed to fetch guest list');
    }
  },
);

// ── GET /weddings/:id/guests/stats — must come BEFORE /:guestId ──────────────

guestRouter.get(
  '/weddings/:id/guests/stats',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const stats = await getRsvpStats(weddingId, req.user!.id);
      ok(res, stats);
    } catch (e) {
      handleError(res, e, 'Failed to fetch RSVP stats');
    }
  },
);

// ── GET /weddings/:id/guests/analytics ────────────────────────────────────────

guestRouter.get(
  '/weddings/:id/guests/analytics',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const analytics = await getRsvpAnalytics(weddingId, req.user!.id);
      ok(res, analytics);
    } catch (e) {
      handleError(res, e, 'Failed to fetch analytics');
    }
  },
);

// ── GET /weddings/:id/guests/export.csv ───────────────────────────────────────

guestRouter.get(
  '/weddings/:id/guests/export.csv',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const list = await getGuestList(weddingId, req.user!.id);
      const csv = exportGuestsToCsv(list);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="guests-${weddingId}.csv"`);
      res.send(csv);
    } catch (e) {
      handleError(res, e, 'Failed to export guests CSV');
    }
  },
);

// ── POST /weddings/:id/guests/import-csv ──────────────────────────────────────

guestRouter.post(
  '/weddings/:id/guests/import-csv',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = CsvImportGuestsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const rows = parseGuestCsv(parsed.data.csv);
      const valid = rows.filter(r => r.data).map(r => r.data!);
      const invalid = rows.filter(r => r.error).map(r => ({ rowIndex: r.rowIndex, error: r.error }));

      let imported = 0;
      if (valid.length > 0) {
        const result = await bulkImportGuests(weddingId, req.user!.id, { guests: valid });
        imported = result.imported;
      }
      ok(res, { imported, invalid }, 201);
    } catch (e) {
      handleError(res, e, 'Failed to import CSV');
    }
  },
);

// ── POST /weddings/:id/guests ─────────────────────────────────────────────────

guestRouter.post(
  '/weddings/:id/guests',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = AddGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const guest = await addGuest(weddingId, req.user!.id, parsed.data);
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
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = BulkImportGuestsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const result = await bulkImportGuests(weddingId, req.user!.id, parsed.data);
      ok(res, result, 201);
    } catch (e) {
      handleError(res, e, 'Failed to bulk import guests');
    }
  },
);

// ── GET /weddings/:id/guests/:guestId/address ─────────────────────────────────

guestRouter.get(
  '/weddings/:id/guests/:guestId/address',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }
    try {
      const addr = await getGuestAddress(weddingId, guestId, req.user!.id);
      ok(res, addr);
    } catch (e) {
      handleError(res, e, 'Failed to fetch address');
    }
  },
);

guestRouter.put(
  '/weddings/:id/guests/:guestId/address',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }

    const parsed = UpsertGuestAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const addr = await upsertGuestAddress(weddingId, guestId, req.user!.id, parsed.data);
      ok(res, addr);
    } catch (e) {
      handleError(res, e, 'Failed to upsert address');
    }
  },
);

// ── GET/PUT /weddings/:id/guests/:guestId/ceremony-prefs ──────────────────────

guestRouter.get(
  '/weddings/:id/guests/:guestId/ceremony-prefs',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }
    try {
      const prefs = await getGuestCeremonyPrefs(weddingId, guestId, req.user!.id);
      ok(res, { prefs });
    } catch (e) {
      handleError(res, e, 'Failed to fetch ceremony prefs');
    }
  },
);

guestRouter.put(
  '/weddings/:id/guests/:guestId/ceremony-prefs',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }

    const parsed = UpsertCeremonyPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const prefs = await upsertGuestCeremonyPrefs(weddingId, guestId, req.user!.id, parsed.data);
      ok(res, { prefs });
    } catch (e) {
      handleError(res, e, 'Failed to upsert ceremony prefs');
    }
  },
);

// ── POST /weddings/:id/guests/:guestId/check-in ───────────────────────────────

guestRouter.post(
  '/weddings/:id/guests/:guestId/check-in',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }

    const parsed = CheckInGuestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const guest = await checkInGuest(weddingId, guestId, req.user!.id, parsed.data.checkedIn);
      ok(res, guest);
    } catch (e) {
      handleError(res, e, 'Failed to check in guest');
    }
  },
);

// ── GET /weddings/:id/guests/:guestId ─────────────────────────────────────────

guestRouter.get(
  '/weddings/:id/guests/:guestId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }
    try {
      const guest = await getGuestRich(weddingId, guestId, req.user!.id);
      ok(res, guest);
    } catch (e) {
      handleError(res, e, 'Failed to fetch guest');
    }
  },
);

// ── PUT /weddings/:id/guests/:guestId — RICH UPDATE ───────────────────────────

guestRouter.put(
  '/weddings/:id/guests/:guestId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }

    const parsed = RichUpdateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const guest = await updateGuest(weddingId, guestId, req.user!.id, parsed.data);
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
    const weddingId = reqId(req, 'id');
    const guestId = reqId(req, 'guestId');
    if (!weddingId || !guestId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }
    try {
      await deleteGuest(weddingId, guestId, req.user!.id);
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
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = SendInvitationsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const { getGuestList: gl } = await import('./service.js');
      await gl(weddingId, req.user!.id);
      const result = await sendInvitations(weddingId, parsed.data);
      ok(res, result);
    } catch (e) {
      handleError(res, e, 'Failed to send invitations');
    }
  },
);

// ── GET/POST/PUT/DELETE /weddings/:id/rsvp-questions ──────────────────────────

guestRouter.get(
  '/weddings/:id/rsvp-questions',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const questions = await listRsvpQuestions(weddingId, req.user!.id);
      ok(res, { questions });
    } catch (e) {
      handleError(res, e, 'Failed to list questions');
    }
  },
);

guestRouter.post(
  '/weddings/:id/rsvp-questions',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    const parsed = AddRsvpQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const q = await addRsvpQuestion(weddingId, req.user!.id, parsed.data);
      ok(res, q, 201);
    } catch (e) {
      handleError(res, e, 'Failed to add question');
    }
  },
);

guestRouter.put(
  '/weddings/:id/rsvp-questions/:qId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const qId = reqId(req, 'qId');
    if (!weddingId || !qId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }
    const parsed = UpdateRsvpQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const q = await updateRsvpQuestion(weddingId, qId, req.user!.id, parsed.data);
      ok(res, q);
    } catch (e) {
      handleError(res, e, 'Failed to update question');
    }
  },
);

guestRouter.delete(
  '/weddings/:id/rsvp-questions/:qId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    const qId = reqId(req, 'qId');
    if (!weddingId || !qId) { err(res, 'VALIDATION_ERROR', 'Missing ids', 400); return; }
    try {
      await deleteRsvpQuestion(weddingId, qId, req.user!.id);
      ok(res, { deleted: true });
    } catch (e) {
      handleError(res, e, 'Failed to delete question');
    }
  },
);

// ── GET/PUT /weddings/:id/rsvp-deadline ───────────────────────────────────────

guestRouter.get(
  '/weddings/:id/rsvp-deadline',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const d = await getRsvpDeadline(weddingId, req.user!.id);
      ok(res, d);
    } catch (e) {
      handleError(res, e, 'Failed to fetch deadline');
    }
  },
);

guestRouter.put(
  '/weddings/:id/rsvp-deadline',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const weddingId = reqId(req, 'id');
    if (!weddingId) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    const parsed = UpsertRsvpDeadlineSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const d = await upsertRsvpDeadline(weddingId, req.user!.id, parsed.data);
      ok(res, d);
    } catch (e) {
      handleError(res, e, 'Failed to upsert deadline');
    }
  },
);

// ── PUT /rsvp/:token — PUBLIC ─────────────────────────────────────────────────

guestRouter.put(
  '/rsvp/:token',
  async (req: Request, res: Response): Promise<void> => {
    const token = reqId(req, 'token');
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
