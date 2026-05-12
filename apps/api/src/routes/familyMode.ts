/**
 * Family Mode routes — P3 Phase 3 items 9 + 10.
 *
 * Family Compatibility:
 *   POST   /api/v1/family-mode/ratings
 *   GET    /api/v1/family-mode/ratings/:subjectProfileId/:candidateProfileId
 *   DELETE /api/v1/family-mode/ratings/:ratingId
 *
 * Parent Mode — Links:
 *   POST   /api/v1/family-mode/parent/links
 *   POST   /api/v1/family-mode/parent/links/:linkId/approve
 *   DELETE /api/v1/family-mode/parent/links/:linkId
 *   GET    /api/v1/family-mode/parent/links/my
 *
 * Parent Mode — Actions:
 *   POST   /api/v1/family-mode/parent/actions
 *   POST   /api/v1/family-mode/parent/actions/:actionId/approve
 *   POST   /api/v1/family-mode/parent/actions/:actionId/reject
 *   GET    /api/v1/family-mode/parent/actions/pending
 *   GET    /api/v1/family-mode/parent/actions/drafted
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import * as familyCompat from '../services/familyCompatService.js';
import * as parentMode  from '../services/parentModeService.js';

export const familyModeRouter = Router();

// ── Rate limits (best-effort, fail-open) ─────────────────────────────────────

const RATING_LIMIT = 30;
const ACTION_LIMIT = 20;
const WINDOW_SEC   = 3600;

async function checkRate(prefix: string, userId: string, limit: number): Promise<boolean> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) return true;
  try {
    const key = `fam:${prefix}:rl:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SEC);
    return count <= limit;
  } catch {
    return true;
  }
}

function mapServiceError(res: Response, e: unknown, defaultStatus = 400): boolean {
  const svc = e as { code?: string; message?: string };
  if (!svc?.code) return false;
  const status =
    svc.code === 'FORBIDDEN'                ? 403 :
    svc.code === 'NOT_FOUND'                ? 404 :
    svc.code === 'LINK_EXISTS'              ? 409 :
    svc.code === 'INVALID_STATUS'           ? 409 :
    svc.code === 'INSUFFICIENT_PERMISSION'  ? 403 :
    svc.code === 'NO_LINK'                  ? 403 :
    svc.code === 'EXPIRED'                  ? 410 :
    svc.code === 'INVALID_SCORE'            ? 422 :
    svc.code === 'USER_NOT_FOUND'           ? 404 :
    svc.code === 'SELF_LINK'                ? 400 :
    svc.code === 'INVALID_PAYLOAD'          ? 422 :
    svc.code === 'REVOKED'                  ? 410 :
    defaultStatus;
  err(res, svc.code, svc.message ?? 'Service error', status);
  return true;
}

// ── Family Compatibility ─────────────────────────────────────────────────────

const RatingBodySchema = z.object({
  subject_profile_id:   z.string().uuid(),
  candidate_profile_id: z.string().uuid(),
  overall_score:        z.number().int().min(0).max(100),
  concerns:             z.array(z.string().min(1).max(120)).max(10).optional(),
  notes:                z.string().max(2000).optional(),
});

familyModeRouter.post(
  '/ratings',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const parsed = RatingBodySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION', parsed.error.message, 422);
      return;
    }

    if (!(await checkRate('rating', userId, RATING_LIMIT))) {
      err(res, 'RATE_LIMIT_EXCEEDED', 'Too many ratings — try again later', 429);
      return;
    }

    try {
      const result = await familyCompat.submitRating({
        raterUserId:        userId,
        subjectProfileId:   parsed.data.subject_profile_id,
        candidateProfileId: parsed.data.candidate_profile_id,
        overallScore:       parsed.data.overall_score,
        concerns:           parsed.data.concerns,
        notes:              parsed.data.notes,
      });
      ok(res, result, 201);
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.get(
  '/ratings/:subjectProfileId/:candidateProfileId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const subject = z.string().uuid().safeParse(req.params.subjectProfileId);
    const candidate = z.string().uuid().safeParse(req.params.candidateProfileId);
    if (!subject.success || !candidate.success) {
      err(res, 'INVALID_ID', 'Invalid profile id', 400);
      return;
    }

    const ratings = await familyCompat.getRatingsForCandidate(subject.data, candidate.data);
    const joint   = await familyCompat.computeJointScore(subject.data, candidate.data);

    ok(res, { ratings, joint });
  }),
);

familyModeRouter.delete(
  '/ratings/:ratingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const ratingId = z.string().uuid().safeParse(req.params.ratingId);
    if (!ratingId.success) {
      err(res, 'INVALID_ID', 'Invalid rating id', 400);
      return;
    }

    try {
      const removed = await familyCompat.deleteRating(userId, ratingId.data);
      if (!removed) {
        err(res, 'NOT_FOUND', 'Rating not found', 404);
        return;
      }
      ok(res, { deleted: true, ...removed });
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

// ── Parent Mode — Links ──────────────────────────────────────────────────────

const RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING'] as const;
const PERMISSIONS   = ['VIEW_ONLY', 'EDIT_PROFILE', 'DRAFT_ACTIONS', 'FULL_PROXY'] as const;

const CreateLinkSchema = z.object({
  child_user_id:           z.string().min(1),
  relationship:            z.enum(RELATIONSHIPS),
  requested_permissions:   z.enum(PERMISSIONS).optional(),
});

familyModeRouter.post(
  '/parent/links',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const parsed = CreateLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION', parsed.error.message, 422);
      return;
    }

    try {
      const link = await parentMode.createParentLink({
        parentUserId:         userId,
        childUserId:          parsed.data.child_user_id,
        relationship:         parsed.data.relationship,
        ...(parsed.data.requested_permissions
          ? { requestedPermissions: parsed.data.requested_permissions }
          : {}),
      });
      ok(res, link, 201);
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.post(
  '/parent/links/:linkId/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const linkId = z.string().uuid().safeParse(req.params.linkId);
    if (!linkId.success) {
      err(res, 'INVALID_ID', 'Invalid link id', 400);
      return;
    }
    try {
      const link = await parentMode.approveLink(linkId.data, userId);
      ok(res, link);
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.delete(
  '/parent/links/:linkId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const linkId = z.string().uuid().safeParse(req.params.linkId);
    if (!linkId.success) {
      err(res, 'INVALID_ID', 'Invalid link id', 400);
      return;
    }
    try {
      await parentMode.revokeLink(linkId.data, userId);
      ok(res, { revoked: true });
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.get(
  '/parent/links/my',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const links = await parentMode.listMyLinks(userId);
    ok(res, { as_parent: links.asParent, as_child: links.asChild });
  }),
);

// ── Parent Mode — Actions ────────────────────────────────────────────────────

const ACTION_TYPES = [
  'SEND_INTEREST', 'ACCEPT_INTEREST', 'REJECT_INTEREST',
  'SEND_MESSAGE', 'UPDATE_PROFILE', 'BLOCK_USER',
] as const;

const DraftActionSchema = z.object({
  child_user_id: z.string().min(1),
  action_type:   z.enum(ACTION_TYPES),
  payload:       z.record(z.unknown()),
});

familyModeRouter.post(
  '/parent/actions',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const parsed = DraftActionSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION', parsed.error.message, 422);
      return;
    }
    if (!(await checkRate('action', userId, ACTION_LIMIT))) {
      err(res, 'RATE_LIMIT_EXCEEDED', 'Too many drafted actions — try again later', 429);
      return;
    }
    try {
      const action = await parentMode.draftAction({
        parentUserId: userId,
        childUserId:  parsed.data.child_user_id,
        actionType:   parsed.data.action_type,
        payload:      parsed.data.payload,
      });
      ok(res, action, 201);
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.post(
  '/parent/actions/:actionId/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const actionId = z.string().uuid().safeParse(req.params.actionId);
    if (!actionId.success) {
      err(res, 'INVALID_ID', 'Invalid action id', 400);
      return;
    }
    try {
      const action = await parentMode.approveAction(actionId.data, userId);
      ok(res, action);
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.post(
  '/parent/actions/:actionId/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const actionId = z.string().uuid().safeParse(req.params.actionId);
    if (!actionId.success) {
      err(res, 'INVALID_ID', 'Invalid action id', 400);
      return;
    }
    try {
      const action = await parentMode.rejectAction(actionId.data, userId);
      ok(res, action);
    } catch (e) {
      if (!mapServiceError(res, e)) throw e;
    }
  }),
);

familyModeRouter.get(
  '/parent/actions/pending',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const actions = await parentMode.listPendingActions(userId);
    ok(res, actions);
  }),
);

familyModeRouter.get(
  '/parent/actions/drafted',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const actions = await parentMode.listDraftedActions(userId);
    ok(res, actions);
  }),
);
