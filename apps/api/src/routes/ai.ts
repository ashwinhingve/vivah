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
import { env, shouldUseMockMongo } from '../lib/env.js';
import { mockGet } from '../lib/mockStore.js';
import { redis } from '../lib/redis.js';
import { db } from '../lib/db.js';
import { profiles, matchRequests } from '@smartshaadi/db';
import { resolveProfileId } from '../lib/profile.js';
import {
  extractProfileOptimizerFeatures,
} from '../services/profileOptimizerFeatures.js';
import {
  getProfileOptimizerScore,
  type ProfileOptimizerResponse,
} from '../services/profileOptimizerService.js';
import {
  extractMarriageReadinessFeatures,
} from '../services/marriageReadinessFeatures.js';
import {
  getMarriageReadinessScore,
  type MarriageReadinessResponse,
} from '../services/marriageReadinessService.js';
import {
  getConversationSuggestions,
  getEmotionalScore,
  getDivorceProbability,
  getFiiCompatibility,
  type ProfileSnapshot,
  type CoachResponse,
  type EmotionalScoreResponse,
  type DpiResponse,
  type FiiCompatibilityResponse,
} from '../services/aiService.js';
import { extractFiiSignals } from '../services/fiiScore.js';
import {
  DpiPrivacyError,
  assertRequesterParticipation,
  buildCacheKey,
  sanitizeForLogging,
} from '../services/dpiPrivacy.js';
import { extractFeatures, type DpiProfile, type DpiProfileContent } from '../services/dpiFeatures.js';
import { logger } from '../lib/logger.js';
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
// AI-inference standard is 30/hour. Coach is held to 10/hour because every
// call is a full Sonnet completion — the strictest per-request cost on the
// platform, so the cap exists to bound spend.
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

// ── Emotional Score constants ──────────────────────────────────────────────────
// AI-inference standard is 30/hour. Emotional is at 60/hour because the score
// is a local sentiment model lookup with no LLM cost — capacity bound, not
// spend bound.
const EMOTIONAL_RATE_LIMIT = 60;
const EMOTIONAL_RATE_WINDOW_SEC = 3600; // 1 hour
// AI-inference cache standard is 1h; emotional score is cached 24h because
// the underlying ai-service computation is weekly-scheduled and the signal
// doesn't shift mid-day. 7day rolling window is a moving-average store, not
// a cache.
const EMOTIONAL_CACHE_TTL_SEC   = 86400; // 24 hours — slow-moving signal
const EMOTIONAL_7DAY_TTL_SEC    = 7 * 24 * 3600;

const EMOTIONAL_FALLBACK: EmotionalScoreResponse & { fallback: boolean } = {
  score:        50,
  label:        'STEADY',
  trend:        'stable',
  breakdown:    { sentiment: 50, enthusiasm: 50, engagement: 50, curiosity: 50 },
  last_updated: new Date().toISOString(),
  fallback:     true,
};

async function checkEmotionalRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: EMOTIONAL_RATE_LIMIT - 1 };
  }
  const key = `emotional:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, EMOTIONAL_RATE_WINDOW_SEC);
    return { allowed: count <= EMOTIONAL_RATE_LIMIT, remaining: Math.max(0, EMOTIONAL_RATE_LIMIT - count) };
  } catch {
    return { allowed: true, remaining: 0 };
  }
}

// ── GET /api/v1/ai/emotional-score/:matchId ────────────────────────────────────

aiRouter.get(
  '/emotional-score/:matchId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { matchId } = req.params;

    // ── Rate limit ──────────────────────────────────────────────────────────
    const { allowed, remaining } = await checkEmotionalRateLimit(userId);
    if (!allowed) {
      res.setHeader('X-RateLimit-Limit', EMOTIONAL_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Too many emotional score requests. Try again later.', 429);
      return;
    }
    res.setHeader('X-RateLimit-Limit', EMOTIONAL_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);

    // ── Validate matchId ────────────────────────────────────────────────────
    const uuidParse = z.string().uuid().safeParse(matchId);
    if (!uuidParse.success) {
      err(res, 'VALIDATION_ERROR', 'matchId must be a valid UUID', 400);
      return;
    }
    const safeMatchId = uuidParse.data;

    // ── Resolve userId → profileId (CLAUDE.md rule 12) ─────────────────────
    const [callerPgProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!callerPgProfile) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // ── Verify match participation ──────────────────────────────────────────
    const [match] = await db
      .select({
        id:         matchRequests.id,
        senderId:   matchRequests.senderId,
        receiverId: matchRequests.receiverId,
        status:     matchRequests.status,
      })
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.id, safeMatchId),
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

    // ── Try Redis cache ─────────────────────────────────────────────────────
    const cacheKey = `emotional:${safeMatchId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as EmotionalScoreResponse;
        ok(res, { ...parsed, cached: true });
        return;
      }
    } catch {
      // Cache read failure — proceed to compute
    }

    // ── Fetch last 20 messages ──────────────────────────────────────────────
    let messages: Array<{ sender: 'A' | 'B'; text: string; timestamp: string }> = [];
    try {
      const internalBase = env.API_BASE_URL ?? 'http://localhost:4000';
      const msgRes = await fetch(
        `${internalBase}/internal/chat/${safeMatchId}/messages?limit=20`,
        {
          headers: { 'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY },
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (msgRes.ok) {
        const body = await msgRes.json() as { data?: { messages?: typeof messages } };
        messages = body.data?.messages ?? [];
      }
    } catch {
      // Non-fatal — use empty messages (will return neutral score)
    }

    // ── Fetch 7-day rolling avg ─────────────────────────────────────────────
    let historicalAvg: number | null = null;
    try {
      const avgKey = `emotional:${safeMatchId}:7day_avg`;
      const avgRaw = await redis.get(avgKey);
      if (avgRaw) historicalAvg = parseFloat(avgRaw);
    } catch {
      // Non-fatal
    }

    // ── Call AI service ─────────────────────────────────────────────────────
    try {
      const scoreResult = await getEmotionalScore(safeMatchId, messages, historicalAvg);

      // Cache result 24h
      try {
        await redis.set(cacheKey, JSON.stringify(scoreResult), 'EX', EMOTIONAL_CACHE_TTL_SEC);

        // Update 7-day rolling avg via sorted set: member=timestamp, score=score value
        const avgZKey = `emotional:${safeMatchId}:7day_scores`;
        const nowMs   = Date.now();
        const cutoffMs = nowMs - EMOTIONAL_7DAY_TTL_SEC * 1000;
        await redis.zadd(avgZKey, nowMs, `${nowMs}:${scoreResult.score}`);
        await redis.zremrangebyscore(avgZKey, '-inf', cutoffMs);

        // Compute running avg and store as simple key for fast lookup
        const allMembers = await redis.zrange(avgZKey, 0, -1);
        if (allMembers.length > 0) {
          const scores = allMembers.map((m) => {
            const parts = (m as string).split(':');
            return parseFloat(parts[1] ?? '50');
          });
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          await redis.set(`emotional:${safeMatchId}:7day_avg`, avg.toFixed(2), 'EX', EMOTIONAL_7DAY_TTL_SEC);
        }
      } catch {
        // Cache write failure — still return result
      }

      ok(res, { ...scoreResult, cached: false });
    } catch {
      // Graceful fallback — never 500 on AI service failure
      ok(res, { ...EMOTIONAL_FALLBACK, last_updated: new Date().toISOString() });
    }
  }),
);

// ── DPI constants ─────────────────────────────────────────────────────────────
// AI-inference standard is 30/hour. DPI uses 5/DAY because it's a sensitive
// mental-health-adjacent indicator and we cap exposure to avoid score-shopping.
const DPI_RATE_LIMIT     = 5;   // 5 per user per DAY (stricter than other routes)
// AI-inference cache standard is 1h; DPI is cached 24h because results are
// stable per-user/day and the rate limit (5/day) makes a longer cache cheap.
const DPI_CACHE_TTL_SEC  = 86400; // 24 hours

const DPI_DISCLAIMER =
  'This indicator is generated by AI using statistical patterns. ' +
  'It is not a predictor of your personal relationship outcome. ' +
  'All healthy relationships require ongoing care and communication.';

const DPI_FALLBACK: DpiResponse & { fallback: boolean } = {
  score: 0.5,
  level: 'MEDIUM',
  label: 'Some Areas to Discuss',
  narrative:
    'Every relationship has areas where partners can grow together. ' +
    'Focus on open communication and shared goals to build a strong foundation.',
  suggestion:
    'Consider having a calm conversation about your long-term goals and ' +
    'what a fulfilling partnership looks like for both of you.',
  top_factors: [],
  shared_strengths: [],
  disclaimer: DPI_DISCLAIMER,
  computed_at: new Date().toISOString(),
  fallback: true,
};

async function checkDpiRateLimit(
  userId: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // DPI rate limit is always enforced (tests mock Redis directly to test this path)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `dpi:rate:${userId}:${today}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First hit today — set 24h expiry
      await redis.expire(key, 86400);
    }
    if (count > DPI_RATE_LIMIT) {
      // Compute seconds remaining today (UTC midnight)
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCHours(24, 0, 0, 0);
      const retryAfter = Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfter };
    }
    return { allowed: true };
  } catch {
    // Redis unavailable — fail open
    return { allowed: true };
  }
}

// ── GET /api/v1/ai/divorce-indicator/:matchId ─────────────────────────────────

aiRouter.get(
  '/divorce-indicator/:matchId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { matchId } = req.params;

    // ── Validate matchId ────────────────────────────────────────────────────
    const uuidParse = z.string().uuid().safeParse(matchId);
    if (!uuidParse.success) {
      err(res, 'VALIDATION_ERROR', 'matchId must be a valid UUID', 400);
      return;
    }
    const safeMatchId = uuidParse.data;

    // ── Rate limit: 5 per user per day ──────────────────────────────────────
    const rl = await checkDpiRateLimit(userId);
    if (!rl.allowed) {
      res.setHeader('Retry-After', rl.retryAfter ?? 86400);
      err(res, 'RATE_LIMIT_EXCEEDED', 'DPI rate limit reached. Try again tomorrow.', 429);
      return;
    }

    // ── Redis cache check (requester-scoped key) ─────────────────────────────
    const cacheKey = buildCacheKey(userId, safeMatchId);
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, JSON.parse(cached) as DpiResponse);
        return;
      }
    } catch {
      // Cache read failure — proceed to compute
    }

    // ── Resolve userId → profileId ──────────────────────────────────────────
    const requesterProfileId = await resolveProfileId(userId);
    if (!requesterProfileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // ── Privacy: assert match participation + ACCEPTED status ───────────────
    let otherProfileId: string;
    try {
      ({ otherProfileId } = await assertRequesterParticipation(
        requesterProfileId,
        safeMatchId,
        db,
      ));
    } catch (e) {
      if (e instanceof DpiPrivacyError) {
        err(res, 'DPI_PRIVACY_VIOLATION', e.message, 403);
        return;
      }
      const appErr = e as { code?: string; status?: number; message?: string };
      if (appErr.code === 'MATCH_NOT_FOUND') {
        err(res, 'MATCH_NOT_FOUND', 'Match not found', 404);
        return;
      }
      throw e;
    }

    // ── Fetch both profiles from PostgreSQL ──────────────────────────────────
    const [callerPgProfile] = await db
      .select({
        id:        profiles.id,
        userId:    profiles.userId,
        latitude:  profiles.latitude,
        longitude: profiles.longitude,
      })
      .from(profiles)
      .where(eq(profiles.id, requesterProfileId))
      .limit(1);

    const [otherPgProfile] = await db
      .select({
        id:        profiles.id,
        userId:    profiles.userId,
        latitude:  profiles.latitude,
        longitude: profiles.longitude,
      })
      .from(profiles)
      .where(eq(profiles.id, otherProfileId))
      .limit(1);

    if (!callerPgProfile || !otherPgProfile) {
      ok(res, { ...DPI_FALLBACK, computed_at: new Date().toISOString() });
      return;
    }

    // ── Enrich with MongoDB content ──────────────────────────────────────────
    // Reads must align with content.service.ts writes (shouldUseMockMongo gate).
    // Returning {} unconditionally in mock mode dropped real profile data and
    // produced low-quality DPI scores that surfaced as canned-looking output.
    async function fetchContent(pgUserId: string): Promise<DpiProfileContent> {
      if (shouldUseMockMongo) {
        return (mockGet(pgUserId) ?? {}) as DpiProfileContent;
      }
      try {
        const content = await (ProfileContent as { findOne: (q: object) => { select: (f: string) => { lean: () => Promise<unknown> } } })
          .findOne({ userId: pgUserId })
          .select(
            'personal.dob personal.religion education.degree profession.incomeRange ' +
            'family.familyValues lifestyle.diet lifestyle.smoking lifestyle.drinking ' +
            'lifestyle.interests lifestyle.hyperNicheTags horoscope.gunaScore ' +
            'partnerPreferences communityZone',
          )
          .lean();
        return (content ?? {}) as DpiProfileContent;
      } catch {
        return {};
      }
    }

    const [contentA, contentB] = await Promise.all([
      fetchContent(callerPgProfile.userId),
      fetchContent(otherPgProfile.userId),
    ]);

    const profileA: DpiProfile = {
      id: callerPgProfile.id,
      userId: callerPgProfile.userId,
      latitude: callerPgProfile.latitude,
      longitude: callerPgProfile.longitude,
      content: contentA ?? {},
    };

    const profileB: DpiProfile = {
      id: otherPgProfile.id,
      userId: otherPgProfile.userId,
      latitude: otherPgProfile.latitude,
      longitude: otherPgProfile.longitude,
      content: contentB ?? {},
    };

    // ── Extract features ─────────────────────────────────────────────────────
    const features = await extractFeatures(profileA, profileB, safeMatchId);

    // ── Compute shared strengths (set intersection of interests/tags, max 5) ─
    const interestsA = new Set([
      ...(contentA?.lifestyle?.interests ?? []),
      ...(contentA?.lifestyle?.hyperNicheTags ?? []),
    ]);
    const interestsB = new Set([
      ...(contentB?.lifestyle?.interests ?? []),
      ...(contentB?.lifestyle?.hyperNicheTags ?? []),
    ]);
    const sharedStrengths: string[] = [];
    for (const item of interestsA) {
      if (interestsB.has(item)) sharedStrengths.push(item);
      if (sharedStrengths.length >= 5) break;
    }

    // ── Build brief profile summaries for LLM context ───────────────────────
    function summarize(p: DpiProfile): string {
      const c = p.content ?? {};
      const parts: string[] = [];
      const religion = c.personal?.religion ?? '';
      const edu = c.education?.degree ?? '';
      const income = c.profession?.incomeRange ?? '';
      const city = (c as { location?: { city?: string } }).location?.city ?? '';
      if (religion) parts.push(religion);
      if (edu) parts.push(edu);
      if (income) parts.push(`${income} income`);
      if (city) parts.push(city);
      return parts.join(', ') || 'profile data unavailable';
    }

    // ── Call AI service ─────────────────────────────────────────────────────
    let dpiResult: DpiResponse;
    try {
      dpiResult = await getDivorceProbability(
        userId,
        safeMatchId,
        features,
        { a: summarize(profileA), b: summarize(profileB) },
        sharedStrengths,
      );
    } catch (e) {
      const appErr = e as { code?: string };
      if (appErr.code === 'AI_SERVICE_UNAVAILABLE') {
        // Graceful fallback — never return 500 to user for AI service failure
        ok(res, { ...DPI_FALLBACK, computed_at: new Date().toISOString() });
        return;
      }
      // AbortError / TimeoutError — also fallback
      const isTimeout =
        e instanceof Error &&
        (e.name === 'TimeoutError' || e.name === 'AbortError');
      if (isTimeout) {
        ok(res, { ...DPI_FALLBACK, computed_at: new Date().toISOString() });
        return;
      }
      throw e;
    }

    // ── Cache 24h (requester-scoped) ─────────────────────────────────────────
    try {
      await redis.set(cacheKey, JSON.stringify(dpiResult), 'EX', DPI_CACHE_TTL_SEC);
    } catch {
      // Cache write failure — still return result
    }

    // ── Sanitized log (NEVER log raw score/narrative) ───────────────────────
    logger.info({ dpi: sanitizeForLogging(dpiResult, userId) }, 'dpi.computed');

    ok(res, dpiResult);
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// FII (Family Inclination Index) routes
// ─────────────────────────────────────────────────────────────────────────────

// AI-inference standard is 30/hour. FII Score is 60/hour because it runs a
// local FII scoring model with no LLM cost (matches Emotional). FII Compat is
// 30/hour because it can take the Sonnet-narrative path which is expensive.
const FII_SCORE_RATE_LIMIT      = 60;   // 60/user/hour — local model, no LLM cost
const FII_COMPAT_RATE_LIMIT     = 30;   // 30/user/hour — Sonnet narrative path is expensive
const FII_RATE_WINDOW_SEC       = 3600; // 1 hour
// AI-inference cache standard is 1h. FII compat template path is 24h
// because the template is deterministic over stable inputs (no LLM); the
// Sonnet path matches the standard 1h. Score is 24h — trait-level signal,
// doesn't drift hour-to-hour.
const FII_CACHE_TTL_SEC         = 86400;         // 24h — deterministic template path
const FII_LLM_CACHE_TTL_SEC     = 3600;          // 1h  — matches AI standard (Sonnet path)
const FII_SCORE_CACHE_TTL_SEC   = 86400;         // 24h — trait-level, low drift

// Score-only label bands (used when ai-service doesn't return one)
function fiiLabel(score: number): string {
  if (score >= 80) return 'Very High Family Inclination';
  if (score >= 60) return 'High Family Inclination';
  if (score >= 40) return 'Moderate Family Inclination';
  if (score >= 20) return 'Low Family Inclination';
  return 'Minimal Family Inclination';
}

// ── Rate limit helpers (Redis INCR + EXPIRE, mirror DPI/Emotional pattern) ───

async function checkFiiScoreRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: FII_SCORE_RATE_LIMIT - 1 };
  }
  const key = `fii:score:rate:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, FII_RATE_WINDOW_SEC);
    return { allowed: count <= FII_SCORE_RATE_LIMIT, remaining: Math.max(0, FII_SCORE_RATE_LIMIT - count) };
  } catch {
    return { allowed: true, remaining: FII_SCORE_RATE_LIMIT - 1 };
  }
}

async function checkFiiCompatRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: FII_COMPAT_RATE_LIMIT - 1 };
  }
  const key = `fii:compat:rate:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, FII_RATE_WINDOW_SEC);
    return { allowed: count <= FII_COMPAT_RATE_LIMIT, remaining: Math.max(0, FII_COMPAT_RATE_LIMIT - count) };
  } catch {
    return { allowed: true, remaining: FII_COMPAT_RATE_LIMIT - 1 };
  }
}

// ── GET /api/v1/ai/fii/score/:profileId ──────────────────────────────────────

aiRouter.get(
  '/fii/score/:profileId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { profileId } = req.params;

    // Validate profileId is a UUID
    const uuidParse = z.string().uuid().safeParse(profileId);
    if (!uuidParse.success) {
      err(res, 'VALIDATION_ERROR', 'profileId must be a valid UUID', 400);
      return;
    }
    const safeProfileId = uuidParse.data;

    // Rate limit: 60/hour
    const rl = await checkFiiScoreRateLimit(userId);
    if (!rl.allowed) {
      err(res, 'RATE_LIMIT_EXCEEDED', 'FII score rate limit reached. Try again later.', 429);
      return;
    }

    // Verify profile exists
    const [profileRow] = await db
      .select({ id: profiles.id, userId: profiles.userId, familyInclinationScore: profiles.familyInclinationScore })
      .from(profiles)
      .where(eq(profiles.id, safeProfileId))
      .limit(1);

    if (!profileRow) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // Cache lookup: fii:profile:{profileId}
    const cacheKey = `fii:profile:${safeProfileId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, JSON.parse(cached) as { score: number; label: string; breakdown: object });
        return;
      }
    } catch {
      // Cache read failure — proceed to compute
    }

    // Use stored score (persisted by scoreFamilySection / recompute-score endpoint)
    const storedScore = profileRow.familyInclinationScore ?? 0;
    const label = fiiLabel(storedScore);

    // Build breakdown from signals for richer response
    let breakdown: object;
    try {
      const signals = await extractFiiSignals(profileRow.userId);
      breakdown = signals;
    } catch {
      breakdown = {};
    }

    const result = { score: storedScore, label, breakdown };

    // Cache 24h
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', FII_SCORE_CACHE_TTL_SEC);
    } catch {
      // Cache write failure — still return result
    }

    ok(res, result);
  }),
);

// ── GET /api/v1/ai/fii/compatibility/:matchId ─────────────────────────────────

aiRouter.get(
  '/fii/compatibility/:matchId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { matchId } = req.params;

    // Validate matchId
    const uuidParse = z.string().uuid().safeParse(matchId);
    if (!uuidParse.success) {
      err(res, 'VALIDATION_ERROR', 'matchId must be a valid UUID', 400);
      return;
    }
    const safeMatchId = uuidParse.data;

    // ?detailed=true → use_llm_narrative=true (Sonnet path)
    const detailed = req.query['detailed'] === 'true';

    // Rate limit: 30/hour
    const rl = await checkFiiCompatRateLimit(userId);
    if (!rl.allowed) {
      err(res, 'RATE_LIMIT_EXCEEDED', 'FII compatibility rate limit reached. Try again later.', 429);
      return;
    }

    // Resolve userId → profileId (Rule 12)
    const requesterProfileId = await resolveProfileId(userId);
    if (!requesterProfileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // Verify match exists and requester is a participant (either side)
    const [matchRow] = await db
      .select({
        id:         matchRequests.id,
        senderId:   matchRequests.senderId,
        receiverId: matchRequests.receiverId,
        status:     matchRequests.status,
      })
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.id, safeMatchId),
          eq(matchRequests.status, 'ACCEPTED'),
          or(
            eq(matchRequests.senderId, requesterProfileId),
            eq(matchRequests.receiverId, requesterProfileId),
          ),
        ),
      )
      .limit(1);

    if (!matchRow) {
      err(res, 'MATCH_NOT_FOUND', 'Match not found or access denied', 403);
      return;
    }

    const otherProfileId =
      matchRow.senderId === requesterProfileId
        ? matchRow.receiverId
        : matchRow.senderId;

    // Cache: fii:match:{matchId}:{sonnet|template} — match-scoped, NOT requester-scoped
    const cacheKey = `fii:match:${safeMatchId}:${detailed ? 'sonnet' : 'template'}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, JSON.parse(cached) as FiiCompatibilityResponse);
        return;
      }
    } catch {
      // Cache read failure — proceed to compute
    }

    // Fetch userId values for both profiles (needed for extractFiiSignals)
    const [pgA] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, requesterProfileId))
      .limit(1);

    const [pgB] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, otherProfileId))
      .limit(1);

    if (!pgA || !pgB) {
      err(res, 'PROFILE_NOT_FOUND', 'One or both profiles not found', 404);
      return;
    }

    // Extract FII signals for both profiles. extractFiiSignals now throws when
    // MongoDB is unavailable (instead of fabricating an all-zero score) —
    // surface as 503 so the UI can show "Score temporarily unavailable"
    // rather than a wrong 0.
    // TODO: surface 'Score temporarily unavailable' in UI
    let signalsA: Awaited<ReturnType<typeof extractFiiSignals>>;
    let signalsB: Awaited<ReturnType<typeof extractFiiSignals>>;
    try {
      [signalsA, signalsB] = await Promise.all([
        extractFiiSignals(pgA.userId),
        extractFiiSignals(pgB.userId),
      ]);
    } catch (e) {
      logger.error({ err: e, matchId: safeMatchId }, 'FII compatibility: signal extraction failed');
      err(res, 'FII_UNAVAILABLE', 'FII score temporarily unavailable', 503);
      return;
    }

    // Call AI service — fallback gracefully if unavailable
    let compatResult: FiiCompatibilityResponse;
    try {
      compatResult = await getFiiCompatibility(
        signalsA,
        signalsB,
        'Profile A',    // masked names — never expose real names/IDs to AI service
        'Profile B',
        detailed,
      );
    } catch (e) {
      const appErr = e as { code?: string };
      if (
        appErr.code === 'AI_SERVICE_UNAVAILABLE' ||
        (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError'))
      ) {
        // Graceful fallback — compute locally from signals
        const { computeFiiScoreFromSignals } = await import('../services/fiiScore.js');
        const scoreA = computeFiiScoreFromSignals(signalsA);
        const scoreB = computeFiiScoreFromSignals(signalsB);
        const compatScore = Math.round((scoreA + scoreB) / 2);
        compatResult = {
          compatibility_score: compatScore,
          label:               fiiLabel(compatScore),
          narrative:           'Family alignment assessment temporarily unavailable.',
          breakdown:           signalsA, // return requester's signals as breakdown
          computed_at:         new Date().toISOString(),
          use_llm_narrative:   false,
          fallback:            true,
        };
      } else {
        throw e;
      }
    }

    // Cache: 24h for template path, 1h for Sonnet path
    const ttl = detailed ? FII_LLM_CACHE_TTL_SEC : FII_CACHE_TTL_SEC;
    try {
      await redis.set(cacheKey, JSON.stringify(compatResult), 'EX', ttl);
    } catch {
      // Cache write failure — still return result
    }

    ok(res, compatResult);
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Profile Optimizer routes
// ─────────────────────────────────────────────────────────────────────────────

// AI-inference standard is 30/hour. Profile optimizer is rule-based (no LLM),
// so 30/hour matches the standard.
const PROFILE_OPTIMIZER_RATE_LIMIT = 30;
const PROFILE_OPTIMIZER_RATE_WINDOW_SEC = 3600; // 1 hour
const PROFILE_OPTIMIZER_CACHE_TTL_SEC = 3600;   // 1 hour

async function checkProfileOptimizerRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: PROFILE_OPTIMIZER_RATE_LIMIT - 1 };
  }
  const key = `profile_optimizer:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, PROFILE_OPTIMIZER_RATE_WINDOW_SEC);
    return {
      allowed: count <= PROFILE_OPTIMIZER_RATE_LIMIT,
      remaining: Math.max(0, PROFILE_OPTIMIZER_RATE_LIMIT - count),
    };
  } catch {
    return { allowed: true, remaining: 0 };
  }
}

// ── GET /api/v1/ai/profile-optimizer/:userId ──────────────────────────────────

aiRouter.get(
  '/profile-optimizer/:userId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestingUserId = req.user!.id;
    const { userId: targetUserId } = req.params;

    // Validate userId param is a non-empty string
    if (!targetUserId || targetUserId.trim() === '') {
      err(res, 'VALIDATION_ERROR', 'userId is required', 400);
      return;
    }

    // Auth: owner or ADMIN
    const isAdmin = req.user!.role === 'ADMIN';
    if (requestingUserId !== targetUserId && !isAdmin) {
      err(res, 'FORBIDDEN', 'You can only view your own profile optimizer score', 403);
      return;
    }

    // Rate limit: 30/hour
    const rl = await checkProfileOptimizerRateLimit(requestingUserId);
    if (!rl.allowed) {
      res.setHeader('X-RateLimit-Limit', PROFILE_OPTIMIZER_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Profile optimizer rate limit reached. Try again later.', 429);
      return;
    }
    res.setHeader('X-RateLimit-Limit', PROFILE_OPTIMIZER_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', rl.remaining);

    // Redis cache check
    const cacheKey = `profile_optimizer:user:${targetUserId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, { ...(JSON.parse(cached) as ProfileOptimizerResponse), cached: true });
        return;
      }
    } catch {
      // Cache read failure — proceed to compute
    }

    // CLAUDE.md Rule 12: resolve userId → profileId
    const profileId = await resolveProfileId(targetUserId);
    if (!profileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // Extract features from DB + MongoDB
    let features: Awaited<ReturnType<typeof extractProfileOptimizerFeatures>>;
    try {
      features = await extractProfileOptimizerFeatures(targetUserId, profileId);
    } catch (e) {
      const appErr = e as { code?: string; status?: number; message?: string };
      err(
        res,
        appErr.code ?? 'FEATURE_EXTRACTION_ERROR',
        appErr.message ?? 'Failed to extract profile features',
        appErr.status ?? 500,
      );
      return;
    }

    // Call AI service
    let result: ProfileOptimizerResponse;
    try {
      result = await getProfileOptimizerScore({
        user_id: targetUserId,
        photo_count: features.photo_count,
        has_primary_photo: features.has_primary_photo,
        bio_text: features.bio_text,
        profile_completeness: features.profile_completeness,
      });
    } catch (e) {
      const appErr = e as { code?: string };
      if (
        appErr.code === 'AI_SERVICE_UNAVAILABLE' ||
        (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError'))
      ) {
        err(res, 'AI_SERVICE_UNAVAILABLE', 'Profile optimizer service temporarily unavailable', 503);
        return;
      }
      throw e;
    }

    // Cache 1h
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', PROFILE_OPTIMIZER_CACHE_TTL_SEC);
    } catch {
      // Cache write failure — still return result
    }

    ok(res, { ...result, cached: false });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Marriage Readiness routes
// ─────────────────────────────────────────────────────────────────────────────

const MARRIAGE_READINESS_RATE_LIMIT = 30;
const MARRIAGE_READINESS_RATE_WINDOW_SEC = 3600; // 1 hour
const MARRIAGE_READINESS_CACHE_TTL_SEC = 3600;   // 1 hour

async function checkMarriageReadinessRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: MARRIAGE_READINESS_RATE_LIMIT - 1 };
  }
  const key = `marriage_readiness:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, MARRIAGE_READINESS_RATE_WINDOW_SEC);
    return {
      allowed: count <= MARRIAGE_READINESS_RATE_LIMIT,
      remaining: Math.max(0, MARRIAGE_READINESS_RATE_LIMIT - count),
    };
  } catch {
    return { allowed: true, remaining: 0 };
  }
}

// ── GET /api/v1/ai/marriage-readiness/:userId ─────────────────────────────────
// OWNER ONLY — per agreement, this is user-controlled (NOT accessible by admin).

aiRouter.get(
  '/marriage-readiness/:userId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestingUserId = req.user!.id;
    const { userId: targetUserId } = req.params;

    if (!targetUserId || targetUserId.trim() === '') {
      err(res, 'VALIDATION_ERROR', 'userId is required', 400);
      return;
    }

    // OWNER ONLY — no admin exception per agreement
    if (requestingUserId !== targetUserId) {
      err(res, 'FORBIDDEN', 'Marriage Readiness Score is personal — only you can view your own', 403);
      return;
    }

    // Rate limit: 30/hour
    const rl = await checkMarriageReadinessRateLimit(requestingUserId);
    if (!rl.allowed) {
      res.setHeader('X-RateLimit-Limit', MARRIAGE_READINESS_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Marriage readiness rate limit reached. Try again later.', 429);
      return;
    }
    res.setHeader('X-RateLimit-Limit', MARRIAGE_READINESS_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', rl.remaining);

    // Redis cache check
    const cacheKey = `marriage_readiness:user:${targetUserId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        // Also fetch display_allowed from DB (may have changed)
        const [profileRow] = await db
          .select({ displayReadinessScore: profiles.displayReadinessScore })
          .from(profiles)
          .where(eq(profiles.userId, targetUserId))
          .limit(1);

        ok(res, {
          ...(JSON.parse(cached) as MarriageReadinessResponse),
          display_allowed: profileRow?.displayReadinessScore ?? false,
          cached: true,
        });
        return;
      }
    } catch {
      // Cache read failure — proceed to compute
    }

    // CLAUDE.md Rule 12: resolve userId → profileId
    const profileId = await resolveProfileId(targetUserId);
    if (!profileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // Fetch display toggle from DB
    const [profileRow] = await db
      .select({ displayReadinessScore: profiles.displayReadinessScore })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profileRow) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    // Extract features
    let features: Awaited<ReturnType<typeof extractMarriageReadinessFeatures>>;
    try {
      features = await extractMarriageReadinessFeatures(targetUserId, profileId);
    } catch (e) {
      const appErr = e as { code?: string; status?: number; message?: string };
      err(
        res,
        appErr.code ?? 'FEATURE_EXTRACTION_ERROR',
        appErr.message ?? 'Failed to extract readiness features',
        appErr.status ?? 500,
      );
      return;
    }

    // Call AI service
    let result: MarriageReadinessResponse;
    try {
      result = await getMarriageReadinessScore({
        user_id: targetUserId,
        avg_msg_count_per_conv: features.avg_msg_count_per_conv,
        avg_msg_length: features.avg_msg_length,
        profile_completeness: features.profile_completeness,
        age_pref_set: features.age_pref_set,
        religion_pref_set: features.religion_pref_set,
        distance_pref_set: features.distance_pref_set,
        education_pref_set: features.education_pref_set,
        lifestyle_pref_set: features.lifestyle_pref_set,
      });
    } catch (e) {
      const appErr = e as { code?: string };
      if (
        appErr.code === 'AI_SERVICE_UNAVAILABLE' ||
        (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError'))
      ) {
        err(res, 'AI_SERVICE_UNAVAILABLE', 'Marriage readiness service temporarily unavailable', 503);
        return;
      }
      throw e;
    }

    // Cache 1h
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', MARRIAGE_READINESS_CACHE_TTL_SEC);
    } catch {
      // Cache write failure — still return result
    }

    ok(res, {
      ...result,
      display_allowed: profileRow.displayReadinessScore,
      cached: false,
    });
  }),
);

// ── PATCH /api/v1/ai/marriage-readiness/:userId/display ───────────────────────
// OWNER ONLY — updates display_readiness_score toggle on profiles table.

const DisplayToggleSchema = z.object({
  display: z.boolean(),
});

aiRouter.patch(
  '/marriage-readiness/:userId/display',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestingUserId = req.user!.id;
    const { userId: targetUserId } = req.params;

    if (!targetUserId || targetUserId.trim() === '') {
      err(res, 'VALIDATION_ERROR', 'userId is required', 400);
      return;
    }

    // OWNER ONLY
    if (requestingUserId !== targetUserId) {
      err(res, 'FORBIDDEN', 'You can only update your own display toggle', 403);
      return;
    }

    const parsed = DisplayToggleSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }
    const { display } = parsed.data;

    // CLAUDE.md Rule 12: resolve userId → profileId
    const profileId = await resolveProfileId(targetUserId);
    if (!profileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    await db
      .update(profiles)
      .set({ displayReadinessScore: display })
      .where(eq(profiles.id, profileId));

    ok(res, { user_id: targetUserId, display_allowed: display });
  }),
);
