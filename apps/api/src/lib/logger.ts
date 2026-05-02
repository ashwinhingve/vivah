/**
 * Smart Shaadi — Structured logger
 *
 * Single pino instance for the API. Use `logger.child({ requestId })` in
 * middleware, or attach context via `pino-http`. Replaces ad-hoc console.*
 * with JSON-structured logs ready for ingestion (Datadog/Loki/etc).
 */
import pino, { type Logger } from 'pino';

const level = process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'test' ? 'silent' : 'info');

export const logger: Logger = pino({
  level,
  base: {
    service: 'smart-shaadi-api',
    env:     process.env['NODE_ENV'] ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.razorpayKeySecret',
      '*.email',
      '*.phone',
      '*.phoneNumber',
      '*.password',
      '*.token',
      '*.cookie',
      '*.otp',
      '*.aadhaar',
    ],
    remove: true,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export type RequestLogger = Logger;
