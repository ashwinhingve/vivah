/**
 * Smart Shaadi — Request ID middleware
 *
 * Reads `x-request-id` header or generates a fresh ULID-ish id.
 * Echoes the id on the response and exposes a per-request child logger.
 */
import { randomBytes } from 'crypto';
import type { RequestHandler } from 'express';
import { logger, type RequestLogger } from './logger.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: RequestLogger;
    }
  }
}

const HEADER = 'x-request-id';

function newId(): string {
  // 26-char base32-friendly id; sufficient entropy without ulid dep.
  return randomBytes(16).toString('base64url');
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header(HEADER);
  const id = (incoming && incoming.length <= 100 ? incoming : newId());
  req.id = id;
  res.setHeader(HEADER, id);
  req.log = logger.child({ requestId: id });
  next();
};
