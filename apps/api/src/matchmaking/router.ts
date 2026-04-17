/**
 * Smart Shaadi — Matchmaking Router
 *
 * GET  /api/v1/matchmaking/feed                — paginated match feed (Redis cache)
 * GET  /api/v1/matchmaking/score/:profileId    — on-demand compatibility score
 * POST /api/v1/matchmaking/requests            — send a match request
 * PUT  /api/v1/matchmaking/requests/:id        — accept or decline a match request
 */

import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { getCachedFeed, computeAndCacheFeed } from './engine.js';
import { scoreCandidate, type ProfileData } from './scorer.js';
import {
  MatchFeedQuerySchema,
  CompatibilityScoreQuerySchema,
} from '@smartshaadi/schemas';
import { profiles } from '@smartshaadi/db';
import { matchRequestsRouter } from './requests/router.js';

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
        ok(res, cached);
        return;
      }

      // Cache miss — compute fresh feed
      const feed = await computeAndCacheFeed(userId, db, redis);
      ok(res, feed);
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

      // Build minimal ProfileData from the postgres rows
      // Full content (dob, religion, etc.) lives in MongoDB — use safe defaults here
      const toProfileData = (row: typeof userRow): ProfileData => ({
        id:           row.id,
        age:          28,   // placeholder — full data is in MongoDB
        religion:     'Hindu',
        city:         '',
        state:        '',
        incomeMin:    0,
        incomeMax:    999999,
        education:    'bachelors',
        occupation:   '',
        familyType:   'JOINT',
        familyValues: 'MODERATE',
        diet:         'VEG',
        smoke:        false,
        drink:        false,
        preferences: {
          ageMin:           18,
          ageMax:           50,
          religion:         [],
          openToInterfaith: false,
          education:        [],
          incomeMin:        0,
          incomeMax:        999999,
          familyType:       [],
          diet:             [],
        },
      });

      const userProfile      = toProfileData(userRow);
      const candidateProfile = toProfileData(candidateRow);

      const score = await scoreCandidate(
        userId,
        profileId,
        userProfile,
        candidateProfile,
        redis,
      );

      ok(res, score);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to compute score';
      err(res, 'SCORE_ERROR', message, 500);
    }
  },
);



// ── Mount sub-routers ─────────────────────────────────────────────────────────
matchmakingRouter.use('/', matchRequestsRouter);
