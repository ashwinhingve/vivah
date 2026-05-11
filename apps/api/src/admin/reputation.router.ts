/**
 * Admin Reputation Score router — platform-wide trust indicator for support
 * and moderation tooling.
 *
 * Route:
 *   GET /api/v1/admin/users/:userId/reputation
 *
 * Requires an authenticated ADMIN session. Rate-limited to 60/hour per admin.
 * Per-user score cached for 1h.
 */
import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../lib/response.js';
import { extractReputationFeatures } from '../services/reputationFeatures.js';
import {
  getReputation,
  type ReputationResponse,
} from '../services/reputationService.js';

export const reputationAdminRouter = Router();

const REP_RATE_LIMIT = 60;
const REP_RATE_WINDOW_SEC = 3600;
const REP_CACHE_TTL_SEC = 3600;

interface AppErrorish extends Error {
  code?: string;
  status?: number;
}

async function checkReputationRateLimit(
  adminUserId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: REP_RATE_LIMIT - 1 };
  }
  try {
    const key = `reputation:rl:${adminUserId}`;
    const c = await redis.incr(key);
    if (c === 1) await redis.expire(key, REP_RATE_WINDOW_SEC);
    return { allowed: c <= REP_RATE_LIMIT, remaining: Math.max(0, REP_RATE_LIMIT - c) };
  } catch {
    return { allowed: true, remaining: 0 };
  }
}

reputationAdminRouter.get(
  '/users/:userId/reputation',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const adminId = req.user?.id ?? 'unknown';
    const targetUserId = req.params['userId'] ?? '';
    if (!targetUserId) {
      err(res, 'BAD_REQUEST', 'userId required', 400);
      return;
    }

    const rl = await checkReputationRateLimit(adminId);
    if (!rl.allowed) {
      res.setHeader('X-RateLimit-Limit', REP_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Reputation rate limit reached (60/hour)', 429);
      return;
    }

    const cacheKey = `reputation:user:${targetUserId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReputationResponse;
        ok(res, { ...parsed, cached: true });
        return;
      }
    } catch {
      // Cache miss / Redis blip — recompute live.
    }

    try {
      const { features, ghostCountRaw } = await extractReputationFeatures(targetUserId);
      const result = await getReputation(targetUserId, features, ghostCountRaw);

      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', REP_CACHE_TTL_SEC);
      } catch {
        // Best-effort cache write.
      }

      ok(res, { ...result, cached: false });
    } catch (e) {
      const errx = e as AppErrorish;
      if (errx.code === 'AI_SERVICE_UNAVAILABLE') {
        err(res, 'AI_SERVICE_UNAVAILABLE', errx.message, 503);
        return;
      }
      logger.error({ err: errx, targetUserId, adminId }, 'reputation_failed');
      err(res, 'INTERNAL_ERROR', 'Failed to compute reputation', 500);
    }
  },
);
