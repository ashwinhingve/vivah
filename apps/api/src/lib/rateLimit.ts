/**
 * Smart Shaadi — HTTP rate limiting
 *
 * One global limiter (broad anti-abuse) plus stricter buckets on auth /
 * matchmaking / match-request / vendor-search hot paths.
 *
 * In test/mock mode, all limiters are skipped so unit tests stay fast.
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Express, Request, Response, NextFunction } from 'express';
import { env } from './env.js';

const skipFn = (_req: Request, _res: Response): boolean => {
  return env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES;
};

function ipKey(req: Request): string {
  // Use the request id when available so coordinated abuse from a single IP
  // can still be rate limited per-flow without hitting full-IP cap.
  return (req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'unknown');
}

export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit:    600,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  skip:            skipFn,
  keyGenerator:    ipKey,
});

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit:    30,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  skip:            skipFn,
  keyGenerator:    ipKey,
  message: { success: false, error: 'Too many auth attempts; try again shortly.' },
});

export const matchActionLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit:    20,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  skip:            skipFn,
  keyGenerator:    ipKey,
});

export function applyGlobalRateLimit(app: Express): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip for the websocket upgrade and health
    if (req.path === '/health' || req.path.startsWith('/__mock-r2')) return next();
    return globalLimiter(req, res, next);
  });
}
