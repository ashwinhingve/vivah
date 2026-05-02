/**
 * Smart Shaadi — Matchmaking Router
 *
 * GET  /api/v1/matchmaking/feed                — paginated match feed (Redis cache)
 * GET  /api/v1/matchmaking/score/:profileId    — on-demand compatibility score
 * POST /api/v1/matchmaking/requests            — send a match request
 * PUT  /api/v1/matchmaking/requests/:id        — accept or decline a match request
 */

import { Router, type Request, type Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { getCachedFeed, computeAndCacheFeed, enrichRow, rowToProfileData } from './engine.js';
import { scoreCandidate } from './scorer.js';
import { explainMatch } from './explainer.js';
import { haversineKm } from '../lib/geocode.js';
import {
  MatchFeedQuerySchema,
  CompatibilityScoreQuerySchema,
} from '@smartshaadi/schemas';
import { profiles } from '@smartshaadi/db';
import { matchRequestsRouter } from './requests/router.js';
import { shortlistsRouter } from './shortlists/router.js';
import { getWhoLikedMe } from './requests/service.js';
import { getProfileTier, getEntitlements } from '../lib/entitlements.js';

export const matchmakingRouter = Router();

// ── GET /feed ─────────────────────────────────────────────────────────────────

matchmakingRouter.get(
  '/feed',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = MatchFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      // Try cache first
      const cached = await getCachedFeed(userId, redis);
      if (cached !== null) {
        ok(res, { items: cached, total: cached.length, page: 1, limit: cached.length }, 200, {
          page: 1, limit: cached.length, total: cached.length,
        });
        return;
      }

      // Cache miss — compute fresh feed
      const feed = await computeAndCacheFeed(userId, db, redis);
      ok(res, { items: feed, total: feed.length, page: 1, limit: feed.length }, 200, {
        page: 1, limit: feed.length, total: feed.length,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load feed';
      err(res, 'FEED_ERROR', message, 500);
    }
  },
);

// ── GET /score/:profileId ─────────────────────────────────────────────────────

matchmakingRouter.get(
  '/score/:profileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CompatibilityScoreQuerySchema.safeParse(req.params);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid profileId', 400);
      return;
    }

    const userId       = req.user!.id;
    const { profileId } = parsed.data;

    try {
      // Load user's own profile
      const userRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (userRows.length === 0) {
        err(res, 'PROFILE_NOT_FOUND', 'Your profile was not found', 404);
        return;
      }

      const userRow = userRows[0]!;

      // Load candidate profile
      const candidateRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1);

      if (candidateRows.length === 0) {
        err(res, 'PROFILE_NOT_FOUND', 'Candidate profile not found', 404);
        return;
      }

      const candidateRow = candidateRows[0]!;

      // Hydrate both profiles with MongoDB ProfileContent (age, religion,
      // income, lifestyle, preferences) — without this the score uses blank
      // defaults and returns wrong compatibility figures.
      const userEnriched      = await enrichRow({
        id: userRow.id, userId: userRow.userId, isActive: userRow.isActive,
      });
      const candidateEnriched = await enrichRow({
        id: candidateRow.id, userId: candidateRow.userId, isActive: candidateRow.isActive,
      });
      const userProfile      = rowToProfileData(userEnriched);
      const candidateProfile = rowToProfileData(candidateEnriched);

      const score = await scoreCandidate(
        userId,
        profileId,
        userProfile,
        candidateProfile,
        redis,
      );

      const distanceKm =
        typeof userProfile.latitude === 'number' && typeof userProfile.longitude === 'number' &&
        typeof candidateProfile.latitude === 'number' && typeof candidateProfile.longitude === 'number'
          ? haversineKm(
              { lat: userProfile.latitude, lng: userProfile.longitude },
              { lat: candidateProfile.latitude, lng: candidateProfile.longitude },
            )
          : null;
      const explainer = explainMatch(userProfile, candidateProfile, score, distanceKm);

      ok(res, { ...score, explainer, distanceKm });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to compute score';
      err(res, 'SCORE_ERROR', message, 500);
    }
  },
);



// ── GET /who-liked-me ─────────────────────────────────────────────────────────
//
// Returns pending-received requests with sender profile summary. FREE tier
// returns only the count; STANDARD+ get full identity.

matchmakingRouter.get(
  '/who-liked-me',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(Math.max(Number(req.query['limit'] ?? 50), 1), 100);
    try {
      const resolved = await getProfileTier(req.user!.id);
      if (!resolved) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
      const { items, total } = await getWhoLikedMe(resolved.profileId, limit);
      const ent = getEntitlements(resolved.tier);
      if (!ent.canViewWhoLikedMe) {
        ok(res, { items: [], total, locked: true, requiredTier: 'PREMIUM' });
        return;
      }
      ok(res, { items, total, locked: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load likes';
      err(res, 'WHO_LIKED_ME_ERROR', message, 500);
    }
  },
);

// ── GET /similar/:profileId ───────────────────────────────────────────────────
//
// Returns up to 6 profiles similar to the source profile (same religion, same
// community when set). Useful for "You may also like" rail on profile view.

matchmakingRouter.get(
  '/similar/:profileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const sourceId = req.params['profileId'] ?? '';
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(sourceId)) { err(res, 'INVALID_ID', 'Profile id must be a UUID', 400); return; }

    try {
      const cached = await getCachedFeed(req.user!.id, redis);
      const items = (cached ?? []).filter((it) => it.profileId !== sourceId).slice(0, 6);
      ok(res, { items, total: items.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load similar profiles';
      err(res, 'SIMILAR_ERROR', message, 500);
    }
  },
);

// ── GET /profile-of-day ───────────────────────────────────────────────────────
//
// Returns one PREMIUM profile picked by deterministic daily rotation. Reads from
// Redis cache populated by the cron; falls back to a same-tier query when miss.

matchmakingRouter.get(
  '/profile-of-day',
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cached = await redis.get(`pod:${today}`);
      if (cached) { ok(res, JSON.parse(cached) as Record<string, unknown>); return; }

      // Fallback: pick a PREMIUM verified profile with most-recent activity
      const { profiles, profilePhotos } = await import('@smartshaadi/db');
      const [pick] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.premiumTier, 'PREMIUM'), eq(profiles.verificationStatus, 'VERIFIED'), eq(profiles.isActive, true)))
        .orderBy(desc(profiles.lastActiveAt))
        .limit(1);
      if (!pick) { ok(res, null); return; }
      const [photo] = await db
        .select()
        .from(profilePhotos)
        .where(and(eq(profilePhotos.profileId, pick.id), eq(profilePhotos.isPrimary, true)))
        .limit(1);
      const result = {
        profileId: pick.id,
        primaryPhotoKey: photo?.r2Key ?? null,
        date: today,
      };
      await redis.setex(`pod:${today}`, 24 * 60 * 60, JSON.stringify(result));
      ok(res, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile of the day';
      err(res, 'POD_ERROR', message, 500);
    }
  },
);

// ── Mount sub-routers ─────────────────────────────────────────────────────────
matchmakingRouter.use('/', matchRequestsRouter);
matchmakingRouter.use('/shortlists', shortlistsRouter);
