/**
 * Admin Stay Quotient router — churn risk scoring for retention outreach.
 *
 * Routes:
 *   GET /api/v1/admin/users/:userId/stay-quotient
 *   GET /api/v1/admin/users/at-risk
 *
 * All routes require an authenticated ADMIN session. Rate-limited to 60/hour
 * per admin. Per-user score cached for 1h; at-risk listing cached for 30m.
 */
import { Router, type Request, type Response } from 'express';
import { asc, isNull, or, lt } from 'drizzle-orm';
import { z } from 'zod';
import { authenticate, authorize } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../lib/response.js';
import { profiles } from '@smartshaadi/db';
import { extractStayFeatures } from '../services/stayFeatures.js';
import {
  getStayQuotient,
  type StayQuotientResponse,
  type StayRiskBand,
} from '../services/stayService.js';

export const stayQuotientAdminRouter = Router();

// Admin-endpoint standard: 60/user/hour. Stay Quotient inherits the standard
// (admin tooling, not user-facing AI inference).
const STAY_RATE_LIMIT = 60;
const STAY_RATE_WINDOW_SEC = 3600; // 1 hour
const STAY_USER_CACHE_TTL_SEC = 3600;     // 1h — matches AI-inference standard
const STAY_AT_RISK_CACHE_TTL_SEC = 1800;  // 30m — matches admin-query standard
const AT_RISK_CANDIDATE_CAP = 100;

interface AppErrorish extends Error {
  code?: string;
  status?: number;
}

async function checkStayRateLimit(adminUserId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: STAY_RATE_LIMIT - 1 };
  }
  try {
    const key = `stay:rl:${adminUserId}`;
    const c = await redis.incr(key);
    if (c === 1) await redis.expire(key, STAY_RATE_WINDOW_SEC);
    return { allowed: c <= STAY_RATE_LIMIT, remaining: Math.max(0, STAY_RATE_LIMIT - c) };
  } catch {
    return { allowed: true, remaining: 0 };
  }
}

const AtRiskQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  risk_band: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

stayQuotientAdminRouter.get(
  '/users/:userId/stay-quotient',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const adminId = req.user?.id ?? 'unknown';
    const targetUserId = req.params['userId'] ?? '';
    if (!targetUserId) {
      err(res, 'BAD_REQUEST', 'userId required', 400);
      return;
    }

    const rl = await checkStayRateLimit(adminId);
    if (!rl.allowed) {
      res.setHeader('X-RateLimit-Limit', STAY_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Stay Quotient rate limit reached (60/hour)', 429);
      return;
    }

    const cacheKey = `stay:user:${targetUserId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, { ...JSON.parse(cached), cached: true });
        return;
      }
    } catch {
      // Cache miss / Redis blip — recompute live.
    }

    try {
      const features = await extractStayFeatures(targetUserId);
      const result = await getStayQuotient(features);

      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', STAY_USER_CACHE_TTL_SEC);
      } catch {
        // Best-effort cache write; ignore failure.
      }

      ok(res, { ...result, cached: false });
    } catch (e) {
      const errx = e as AppErrorish;
      if (errx.code === 'USER_NOT_FOUND') {
        err(res, 'USER_NOT_FOUND', 'No profile for userId', 404);
        return;
      }
      if (errx.code === 'AI_SERVICE_UNAVAILABLE') {
        err(res, 'AI_SERVICE_UNAVAILABLE', errx.message, 503);
        return;
      }
      logger.error({ err: errx, targetUserId, adminId }, 'stay_quotient_failed');
      err(res, 'INTERNAL_ERROR', 'Failed to compute Stay Quotient', 500);
    }
  },
);

stayQuotientAdminRouter.get(
  '/users/at-risk',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const adminId = req.user?.id ?? 'unknown';

    const parsed = AtRiskQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'BAD_REQUEST', 'Invalid query params', 400);
      return;
    }
    const { limit, offset, risk_band } = parsed.data;

    const rl = await checkStayRateLimit(adminId);
    if (!rl.allowed) {
      res.setHeader('X-RateLimit-Limit', STAY_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Stay Quotient rate limit reached (60/hour)', 429);
      return;
    }

    const cacheKey = `stay:at-risk:${risk_band ?? 'any'}:${limit}:${offset}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, { ...JSON.parse(cached), cached: true });
        return;
      }
    } catch {
      // Recompute on cache failure.
    }

    // Pull a window of stale-or-active profiles ordered oldest-active first.
    // The candidate cap keeps the AI fan-out bounded; admins paginate via
    // limit/offset over the *scored* result set.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const candidates = await db
      .select({ id: profiles.id, userId: profiles.userId })
      .from(profiles)
      .where(or(isNull(profiles.lastActiveAt), lt(profiles.lastActiveAt, sevenDaysAgo)))
      .orderBy(asc(profiles.lastActiveAt))
      .limit(AT_RISK_CANDIDATE_CAP);

    const scored: StayQuotientResponse[] = [];
    for (const c of candidates) {
      try {
        const features = await extractStayFeatures(c.userId);
        const result = await getStayQuotient(features);
        if (!risk_band || result.risk_band === risk_band) {
          scored.push(result);
        }
      } catch (e) {
        logger.warn({ err: e, userId: c.userId }, 'stay_at_risk_score_failed');
      }
    }

    scored.sort((a, b) => b.churn_probability - a.churn_probability);
    const page = scored.slice(offset, offset + limit);

    const payload: { items: StayQuotientResponse[]; total: number; risk_band: StayRiskBand | null } = {
      items: page,
      total: scored.length,
      risk_band: risk_band ?? null,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', STAY_AT_RISK_CACHE_TTL_SEC);
    } catch {
      // Best-effort.
    }

    ok(res, { ...payload, cached: false });
  },
);
