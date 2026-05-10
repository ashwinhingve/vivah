/**
 * Smart Shaadi — Sentry bootstrap
 *
 * No-op when SENTRY_DSN is unset (CI / dev). When set, captures unhandled
 * exceptions, decorates with userId + requestId, and powers slow-route
 * tracing.
 */
import * as Sentry from '@sentry/node';
import { env } from './env.js';
import { logger } from './logger.js';

let initialized = false;

export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info('[sentry] DSN not configured; error capture disabled');
    return;
  }
  if (initialized) return;
  const opts: Parameters<typeof Sentry.init>[0] = {
    dsn:              env.SENTRY_DSN,
    environment:      env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
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
