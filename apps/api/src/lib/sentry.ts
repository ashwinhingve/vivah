/**
 * Smart Shaadi — Sentry bootstrap
 *
 * No-op when SENTRY_DSN is unset (CI / dev). When set, captures unhandled
 * exceptions, decorates with userId + requestId, and powers slow-route
 * tracing.
 */
import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

let initialized = false;

export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) {
    logger.info('[sentry] DSN not configured; error capture disabled');
    return;
  }
  if (initialized) return;
  const opts: Parameters<typeof Sentry.init>[0] = {
    dsn,
    environment:      process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.05'),
    sendDefaultPii:   false,
  };
  const release = process.env['GIT_COMMIT_SHA'];
  if (release) opts.release = release;
  Sentry.init(opts);
  initialized = true;
  logger.info('[sentry] initialized');
}

export function captureException(error: unknown, ctx?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (ctx) {
      for (const [k, v] of Object.entries(ctx)) scope.setExtra(k, v);
    }
    Sentry.captureException(error);
  });
}
