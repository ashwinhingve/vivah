import type { Request, Response, NextFunction } from 'express';
import { enqueueBehaviorEvent } from './service.js';

const SKIP_PREFIXES = [
  '/health',
  '/metrics',
  '/sentry-test',
  '/__forced_error',
  '/api/v1/auth',
];

/**
 * Global behavior-capture middleware. Pure observability: hooks res.finish,
 * checks if the route attached `req.user` (auth middleware ran), and enqueues
 * a compact event. Never blocks the response or throws.
 */
export function behaviorCaptureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const path  = req.path;

  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
    next();
    return;
  }

  res.on('finish', () => {
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    if (!userId) return;

    void enqueueBehaviorEvent({
      userId,
      route:      req.route?.path ?? path,
      method:     req.method,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ts:         new Date().toISOString(),
    });
  });

  next();
}
