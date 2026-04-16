/**
 * Smart Shaadi — Matchmaking Router
 *
 * GET  /api/v1/matchmaking/feed                — paginated match feed (Redis cache)
 * GET  /api/v1/matchmaking/score/:profileId    — on-demand compatibility score
 * POST /api/v1/matchmaking/requests            — send a match request
 * PUT  /api/v1/matchmaking/requests/:id        — accept or decline a match request
 */

import { Router, type Request, type Response } from 'express';
import { eq, and, or } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { getCachedFeed, computeAndCacheFeed } from './engine.js';
import { scoreCandidate, type ProfileData } from './scorer.js';
import {
  MatchFeedQuerySchema,
  CompatibilityScoreQuerySchema,
  MatchRequestSchema,
} from '@smartshaadi/schemas';
import { profiles, matchRequests } from '@smartshaadi/db';

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

// ── POST /requests ────────────────────────────────────────────────────────────

matchmakingRouter.post(
  '/requests',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = MatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    const userId              = req.user!.id;
    const { receiverId, message } = parsed.data;

    try {
      // Resolve the sender's profileId from userId
      const senderRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (senderRows.length === 0) {
        err(res, 'PROFILE_NOT_FOUND', 'Your profile was not found', 404);
        return;
      }

      const senderId = senderRows[0]!.id;

      // Prevent self-request
      if (senderId === receiverId) {
        err(res, 'SELF_REQUEST', 'Cannot send a match request to yourself', 422);
        return;
      }

      // Check receiver profile exists
      const receiverRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, receiverId))
        .limit(1);

      if (receiverRows.length === 0) {
        err(res, 'PROFILE_NOT_FOUND', 'Receiver profile not found', 404);
        return;
      }

      // Check for existing request in either direction
      const existingRows = await db
        .select()
        .from(matchRequests)
        .where(
          or(
            and(eq(matchRequests.senderId, senderId), eq(matchRequests.receiverId, receiverId)),
            and(eq(matchRequests.senderId, receiverId), eq(matchRequests.receiverId, senderId)),
          ),
        )
        .limit(1);

      if (existingRows.length > 0) {
        err(res, 'REQUEST_EXISTS', 'A match request already exists between these profiles', 409);
        return;
      }

      // Insert the new request
      const insertValues: {
        senderId: string;
        receiverId: string;
        status: 'PENDING';
        message?: string;
      } = {
        senderId,
        receiverId,
        status: 'PENDING',
      };
      if (message != null) insertValues.message = message;

      const inserted = await db
        .insert(matchRequests)
        .values(insertValues)
        .returning();

      ok(res, inserted[0], 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create match request';
      err(res, 'REQUEST_ERROR', message, 500);
    }
  },
);

// ── PUT /requests/:id ─────────────────────────────────────────────────────────

matchmakingRouter.put(
  '/requests/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.params['id'] ?? '';

    // Validate action
    const action = (req.body as Record<string, unknown>)['action'];
    if (action !== 'accept' && action !== 'decline') {
      err(res, 'VALIDATION_ERROR', 'action must be "accept" or "decline"', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      // Resolve current user's profileId
      const profileRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (profileRows.length === 0) {
        err(res, 'PROFILE_NOT_FOUND', 'Your profile was not found', 404);
        return;
      }

      const myProfileId = profileRows[0]!.id;

      // Fetch the match request
      const requestRows = await db
        .select()
        .from(matchRequests)
        .where(eq(matchRequests.id, requestId))
        .limit(1);

      if (requestRows.length === 0) {
        err(res, 'REQUEST_NOT_FOUND', 'Match request not found', 404);
        return;
      }

      const request = requestRows[0]!;

      // Only the receiver can accept/decline
      if (request.receiverId !== myProfileId) {
        err(res, 'FORBIDDEN', 'Only the receiver can respond to this request', 403);
        return;
      }

      // Update status
      const newStatus = action === 'accept' ? 'ACCEPTED' : 'DECLINED';

      const updated = await db
        .update(matchRequests)
        .set({
          status:      newStatus,
          respondedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(matchRequests.id, requestId))
        .returning();

      ok(res, updated[0]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update match request';
      err(res, 'REQUEST_ERROR', message, 500);
    }
  },
);
