/**
 * Smart Shaadi — Shortlists Router
 *
 * Mounted at: /api/v1/matchmaking/shortlists
 *
 * POST   /shortlists/:targetProfileId          → addShortlist
 * DELETE /shortlists/:targetProfileId          → removeShortlist
 * GET    /shortlists/mine                      → listShortlists (paginated)
 * GET    /shortlists/is-shortlisted/:targetProfileId → { shortlisted: bool }
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { authenticate } from '../../auth/middleware.js';
import { db } from '../../lib/db.js';
import { ok, err } from '../../lib/response.js';
import {
  addShortlist,
  removeShortlist,
  listShortlists,
  isShortlisted,
  type ServiceError,
} from './service.js';

export const shortlistsRouter = Router();

// ── Zod schemas ───────────────────────────────────────────────────────────────

const AddShortlistBody = z.object({
  note: z.string().max(500).optional(),
});

const PaginationQuery = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Error handler ─────────────────────────────────────────────────────────────

function handleServiceError(res: Response, error: unknown): void {
  const e = error as ServiceError;
  if (e.code) {
    const statusMap: Record<string, number> = {
      SELF_SHORTLIST: 400,
      NOT_FOUND:      404,
      INSERT_FAILED:  500,
    };
    const status = statusMap[e.code] ?? 400;
    err(res, e.code, e.message, status);
    return;
  }
  err(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

// ── Profile ID resolver — Better Auth user ID → profile UUID ──────────────────

async function resolveProfileId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

// ── GET /shortlists/mine ──────────────────────────────────────────────────────
// Must be declared BEFORE /:targetProfileId to prevent param capture

shortlistsRouter.get(
  '/mine',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query params', 400);
      return;
    }

    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }

    const { page, limit } = parsed.data;

    try {
      const result = await listShortlists(profileId, page, limit);
      ok(res, result);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── GET /shortlists/is-shortlisted/:targetProfileId ───────────────────────────

shortlistsRouter.get(
  '/is-shortlisted/:targetProfileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetProfileId = req.params['targetProfileId'];
    if (!targetProfileId) {
      err(res, 'VALIDATION_ERROR', 'Missing targetProfileId', 400);
      return;
    }

    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }

    try {
      const shortlisted = await isShortlisted(profileId, targetProfileId);
      ok(res, { shortlisted });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── POST /shortlists/:targetProfileId ─────────────────────────────────────────

shortlistsRouter.post(
  '/:targetProfileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetProfileId = req.params['targetProfileId'];
    if (!targetProfileId) {
      err(res, 'VALIDATION_ERROR', 'Missing targetProfileId', 400);
      return;
    }

    const parsed = AddShortlistBody.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }

    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }

    try {
      const item = await addShortlist(profileId, targetProfileId, parsed.data.note);
      ok(res, { item }, 201);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── DELETE /shortlists/:targetProfileId ───────────────────────────────────────

shortlistsRouter.delete(
  '/:targetProfileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetProfileId = req.params['targetProfileId'];
    if (!targetProfileId) {
      err(res, 'VALIDATION_ERROR', 'Missing targetProfileId', 400);
      return;
    }

    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }

    try {
      const removed = await removeShortlist(profileId, targetProfileId);
      ok(res, { removed });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);
