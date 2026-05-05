/**
 * AI feature routes — /api/v1/ai/*
 *
 * Requires Better Auth session (authenticate middleware).
 * Mount in index.ts: app.use('/api/v1/ai', aiRouter)
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, or } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import { db } from '../lib/db.js';
import { profiles, matchRequests } from '@smartshaadi/db';
import { resolveProfileId } from '../lib/profile.js';
import {
  getConversationSuggestions,
  type ProfileSnapshot,
  type CoachResponse,
} from '../services/aiService.js';
import { ProfileContent as _ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

// ProfileContent is exported as `unknown` to prevent circular type issues.
// Cast to a minimal interface so we can call .findOne().select().lean().
interface IProfileContentModel extends Model<Record<string, unknown>> {}
const ProfileContent = _ProfileContent as unknown as IProfileContentModel;

export const aiRouter = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const CoachSuggestSchema = z.object({
  matchId: z.string().uuid('matchId must be a valid UUID'),
});

// ── Rate limit helper (10 req/user/hour via Redis INCR/EXPIRE) ────────────────

const COACH_RATE_LIMIT = 10;
const COACH_RATE_WINDOW_SEC = 3600; // 1 hour

async function checkCoachRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  // In test/mock mode, skip Redis rate limit to keep tests fast.
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: COACH_RATE_LIMIT - 1 };
  }

  const key = `coach:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First request — set the expiry window.
      await redis.expire(key, COACH_RATE_WINDOW_SEC);
    }
    const remaining = Math.max(0, COACH_RATE_LIMIT - count);
    return { allowed: count <= COACH_RATE_LIMIT, remaining };
  } catch {
    // If Redis is unavailable, allow the request (fail open) to avoid blocking
    // users when the cache layer is down.
    return { allowed: true, remaining: 0 };
  }
}

// ── Graceful fallback response ────────────────────────────────────────────────

const FALLBACK_RESPONSE: CoachResponse & { fallback: boolean } = {
  suggestions: [],
  state: 'STARTING',
  cached: false,
  fallback: true,
};

// ── POST /api/v1/ai/coach/suggest ─────────────────────────────────────────────

aiRouter.post(
  '/coach/suggest',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    // ── Rate limit ──────────────────────────────────────────────────────────
    const { allowed, remaining } = await checkCoachRateLimit(userId);
    if (!allowed) {
      res.setHeader('X-RateLimit-Limit', COACH_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Too many coach requests. Try again later.', 429);
      return;
    }
    res.setHeader('X-RateLimit-Limit', COACH_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);

    // ── Validate body ───────────────────────────────────────────────────────
    const parsed = CoachSuggestSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    const { matchId } = parsed.data;

    // ── CRITICAL: Resolve userId → profileId (CLAUDE.md rule 12) ───────────
    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // Load caller's PG profile row (id only — rich data comes from MongoDB)
    const [callerPgProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!callerPgProfile) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // ── Verify caller is a participant in this accepted match ───────────────
    const [match] = await db
      .select({
        id: matchRequests.id,
        senderId: matchRequests.senderId,
        receiverId: matchRequests.receiverId,
        status: matchRequests.status,
      })
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.id, matchId),
          eq(matchRequests.status, 'ACCEPTED'),
          or(
            eq(matchRequests.senderId, callerPgProfile.id),
            eq(matchRequests.receiverId, callerPgProfile.id),
          ),
        ),
      )
      .limit(1);

    if (!match) {
      err(res, 'FORBIDDEN', 'You are not a participant in this match or match is not accepted', 403);
      return;
    }

    // ── Fetch the other profile's id ────────────────────────────────────────
    const otherProfileId =
      match.senderId === callerPgProfile.id ? match.receiverId : match.senderId;

    // ── Fetch both profiles' userId for MongoDB lookup ──────────────────────
    const [otherPgProfile] = await db
      .select({ id: profiles.id, userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, otherProfileId))
      .limit(1);

    if (!otherPgProfile) {
      // Other profile vanished — return fallback gracefully
      ok(res, FALLBACK_RESPONSE);
      return;
    }

    // ── Build ProfileSnapshots (interests/hobbies from MongoDB if available) ──
    async function buildSnapshot(pgId: string, pgUserId: string): Promise<ProfileSnapshot> {
      let interests: string[] = [];
      let hobbies: string[] = [];
      let bio = '';
      let occupation = '';
      let city = '';

      if (!env.USE_MOCK_SERVICES) {
        try {
          const content = await ProfileContent.findOne({ userId: pgUserId })
            .select('lifestyle.interests lifestyle.hobbies profession.occupation location.city about')
            .lean();
          if (content) {
            const c = content as {
              lifestyle?: { interests?: string[]; hobbies?: string[] };
              profession?: { occupation?: string };
              location?: { city?: string };
              about?: string;
            };
            interests = c.lifestyle?.interests ?? [];
            hobbies = c.lifestyle?.hobbies ?? [];
            occupation = c.profession?.occupation ?? '';
            city = c.location?.city ?? '';
            bio = (c as unknown as { bio?: string }).bio ?? '';
          }
        } catch {
          // Non-fatal — snapshot with empty fields is still usable
        }
      }

      return {
        profile_id: pgId,
        interests,
        hobbies,
        bio,
        occupation,
        city,
      };
    }

    const [profileASnapshot, profileBSnapshot] = await Promise.all([
      buildSnapshot(callerPgProfile.id, userId),
      buildSnapshot(otherPgProfile.id, otherPgProfile.userId),
    ]);

    // ── Fetch conversation history from internal endpoint ───────────────────
    let conversationHistory: Array<{ sender: 'A' | 'B'; text: string; timestamp: string }> = [];
    try {
      const internalBase = env.API_BASE_URL ?? 'http://localhost:4000';
      const msgRes = await fetch(
        `${internalBase}/internal/chat/${matchId}/messages?limit=20`,
        {
          headers: { 'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY },
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (msgRes.ok) {
        const body = await msgRes.json() as { data?: { messages?: typeof conversationHistory } };
        conversationHistory = body.data?.messages ?? [];
      }
    } catch {
      // Non-fatal — coach still works without history (cold start)
    }

    // ── Call AI service ─────────────────────────────────────────────────────
    try {
      const coachResponse = await getConversationSuggestions(
        profileASnapshot,
        profileBSnapshot,
        conversationHistory,
        matchId,
      );
      ok(res, coachResponse);
    } catch (e) {
      // Graceful fallback — never return 500 to user for AI service failure
      const isAiError =
        e instanceof Error &&
        ((e as { code?: string }).code === 'AI_SERVICE_UNAVAILABLE' ||
          e.name === 'TimeoutError' ||
          e.name === 'AbortError');

      if (isAiError) {
        ok(res, FALLBACK_RESPONSE);
        return;
      }

      // Unexpected error — still fall back gracefully rather than 500ing
      console.error('[ai/coach/suggest] unexpected error:', e);
      ok(res, FALLBACK_RESPONSE);
    }
  }),
);
