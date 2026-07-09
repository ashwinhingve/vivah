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
 *   GET    /api/v1/family-mode/parent/children/:childUserId/profile
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq, inArray, or } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import { db } from '../lib/db.js';
import { user, profiles, profilePhotos, parentChildLinks, parentDraftedActions } from '@smartshaadi/db';
import { getCachedFeed, computeAndCacheFeed } from '../matchmaking/engine.js';
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

// ── Parent Mode — Browse candidates for a linked seeker ──────────────────────
// GET /api/v1/family-mode/parent/children/:childUserId/candidates
// Consent-gated: the caller must hold an APPROVED, non-revoked link to the
// child. Returns the child's own reciprocal match feed (keyed by userId) so a
// guardian can browse, rate and draft interests on their behalf.
familyModeRouter.get(
  '/parent/children/:childUserId/candidates',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parentUserId = req.user!.id;
    const childUserId = String(req.params.childUserId ?? '');
    if (!childUserId) { err(res, 'INVALID_ID', 'Missing child id', 400); return; }

    const link = await parentMode.getActiveLink(parentUserId, childUserId);
    if (!link) { err(res, 'NO_LINK', 'No active link with this family member', 403); return; }

    const page  = Math.max(1, Number(req.query.page ?? '1') || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit ?? '12') || 12));

    const cached = await getCachedFeed(childUserId, redis);
    const feed = cached ?? await computeAndCacheFeed(childUserId, db, redis);
    const total = feed.length;
    const items = feed.slice((page - 1) * limit, (page - 1) * limit + limit);

    ok(res, { items, total, page, limit }, 200, { page, limit, total });
  }),
);

// ── Parent Mode — Resolve a linked child's own matchmaking profile id ────────
// GET /api/v1/family-mode/parent/children/:childUserId/profile
// The family-compatibility view rates a candidate *for* a subject profile —
// when a parent opens it on behalf of a linked child, this resolves the
// child's own profile id (the "subject") the same way the candidates route
// already authorizes browsing that child's feed.
familyModeRouter.get(
  '/parent/children/:childUserId/profile',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parentUserId = req.user!.id;
    const childUserId = String(req.params.childUserId ?? '');
    if (!childUserId) { err(res, 'INVALID_ID', 'Missing child id', 400); return; }

    const link = await parentMode.getActiveLink(parentUserId, childUserId);
    if (!link) { err(res, 'NO_LINK', 'No active link with this family member', 403); return; }

    const [childProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, childUserId))
      .limit(1);

    ok(res, { profileId: childProfile?.id ?? null });
  }),
);

// ── Parent Mode — Resolve ids to display names/photos (humanize UUIDs) ────────
// POST /api/v1/family-mode/parent/resolve  { userIds?: string[], profileIds?: string[] }
//
// Authorization: a caller may ONLY resolve ids they already have a legitimate
// relationship with — their own links (either direction), the profiles they
// themselves drafted actions toward, and their linked children's own profiles.
// Any requested id outside those sets is silently dropped (no data leak, no
// existence oracle). This is a display-name humanizer, never a directory.
familyModeRouter.post(
  '/parent/resolve',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const meId = req.user!.id;
    const body = z.object({
      userIds:    z.array(z.string().min(1)).max(50).optional(),
      profileIds: z.array(z.string().uuid()).max(50).optional(),
    }).safeParse(req.body);
    if (!body.success) { err(res, 'VALIDATION', body.error.message, 422); return; }

    // Build the caller's allow-lists.
    const linkRows = await db
      .select({ parentUserId: parentChildLinks.parentUserId, childUserId: parentChildLinks.childUserId })
      .from(parentChildLinks)
      .where(or(eq(parentChildLinks.parentUserId, meId), eq(parentChildLinks.childUserId, meId)));

    const allowedUserIds = new Set<string>([meId]);
    const myChildUserIds: string[] = [];
    for (const r of linkRows) {
      allowedUserIds.add(r.parentUserId);
      allowedUserIds.add(r.childUserId);
      if (r.parentUserId === meId) myChildUserIds.push(r.childUserId);
    }

    const allowedProfileIds = new Set<string>();
    const actionRows = await db
      .select({ payload: parentDraftedActions.payload })
      .from(parentDraftedActions)
      .where(or(eq(parentDraftedActions.parentUserId, meId), eq(parentDraftedActions.childUserId, meId)));
    for (const a of actionRows) {
      const t = (a.payload as Record<string, unknown> | null)?.['targetProfileId'];
      if (typeof t === 'string') allowedProfileIds.add(t);
    }
    if (myChildUserIds.length > 0) {
      const childProfiles = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(inArray(profiles.userId, myChildUserIds));
      for (const cp of childProfiles) allowedProfileIds.add(cp.id);
    }

    const reqUserIds = (body.data.userIds ?? []).filter((id) => allowedUserIds.has(id));
    const reqProfileIds = (body.data.profileIds ?? []).filter((id) => allowedProfileIds.has(id));

    const users: { userId: string; name: string | null }[] = [];
    if (reqUserIds.length > 0) {
      const rows = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, reqUserIds));
      for (const r of rows) users.push({ userId: r.id, name: r.name });
    }

    const profs: { profileId: string; name: string | null; photoKey: string | null }[] = [];
    if (reqProfileIds.length > 0) {
      const rows = await db
        .select({ profileId: profiles.id, name: user.name })
        .from(profiles)
        .innerJoin(user, eq(user.id, profiles.userId))
        .where(inArray(profiles.id, reqProfileIds));
      const photoRows = await db
        .select({ profileId: profilePhotos.profileId, r2Key: profilePhotos.r2Key })
        .from(profilePhotos)
        .where(and(inArray(profilePhotos.profileId, reqProfileIds), eq(profilePhotos.isPrimary, true)));
      const photoBy = new Map(photoRows.map((p) => [p.profileId, p.r2Key]));
      for (const r of rows) profs.push({ profileId: r.profileId, name: r.name, photoKey: photoBy.get(r.profileId) ?? null });
    }

    ok(res, { users, profiles: profs });
  }),
);
