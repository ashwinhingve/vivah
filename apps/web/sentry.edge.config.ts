import * as Sentry from '@sentry/nextjs';
import { redactSentryEvent } from './src/lib/sentry-redactor';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii:   false,
    release:          process.env.GIT_COMMIT_SHA ?? undefined,
    beforeSend(event) {
      return redactSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
  });
}
