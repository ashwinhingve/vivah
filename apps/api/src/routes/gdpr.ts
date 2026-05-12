/**
 * GDPR routes — Article 15 data export + consent ledger.
 *
 * POST   /api/v1/gdpr/export/request           Enqueue a new export job
 * GET    /api/v1/gdpr/export/status/:id        Poll status for one request
 * GET    /api/v1/gdpr/export/:id/download      Resolve presigned URL + mark accessed
 * GET    /api/v1/gdpr/consent/my               List active consents
 * POST   /api/v1/gdpr/consent                  Record a new consent
 * DELETE /api/v1/gdpr/consent/:type            Withdraw a consent
 *
 * Owner-check: every per-request route compares the requested row's userId
 * against req.user.id and returns 403 on mismatch so admin tokens cannot
 * accidentally cross-user read exports.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import {
  recordConsent, getActiveConsents, withdrawConsent,
  type ConsentType,
} from '../services/consentService.js';
import {
  createExportRequest, getExportRequest, listExportsForUser,
  markDownloaded,
} from '../services/dataExportService.js';
import { scheduleDataExportJob } from '../jobs/dataExportJob.js';

export const gdprRouter = Router();

// ── Rate limit — 1 export request per user per 24 hours ──────────────────────

const EXPORT_RATE_LIMIT = 1;
const EXPORT_RATE_WINDOW_SEC = 24 * 60 * 60;

async function checkExportRateLimit(userId: string): Promise<boolean> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) return true;
  const key = `gdpr:export:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, EXPORT_RATE_WINDOW_SEC);
    return count <= EXPORT_RATE_LIMIT;
  } catch {
    return true;
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

const CONSENT_TYPES = [
  'PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'MARKETING_EMAILS',
  'DATA_SHARING', 'COOKIE_TRACKING', 'ML_TRAINING',
] as const;

const ConsentBodySchema = z.object({
  consent_type:    z.enum(CONSENT_TYPES),
  consent_version: z.string().trim().min(1).max(20),
  consent_given:   z.boolean(),
});

function getClientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim().slice(0, 64);
  return (req.ip ?? null)?.slice(0, 64) ?? null;
}

function getUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

// ── Export routes ────────────────────────────────────────────────────────────

gdprRouter.post(
  '/export/request',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const allowed = await checkExportRateLimit(userId);
    if (!allowed) {
      err(res, 'RATE_LIMIT_EXCEEDED', 'Only one data export per day. Try again tomorrow.', 429);
      return;
    }

    const row = await createExportRequest(userId);
    await scheduleDataExportJob({ requestId: row.id, userId });

    ok(res, {
      requestId:   row.id,
      status:      row.status,
      requestedAt: row.requestedAt,
    }, 202);
  }),
);

gdprRouter.get(
  '/export/status/:requestId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const row = await getExportRequest(req.params.requestId!);
    if (!row) {
      err(res, 'NOT_FOUND', 'Export request not found', 404);
      return;
    }
    if (row.userId !== req.user!.id) {
      err(res, 'FORBIDDEN', 'You do not own this export request', 403);
      return;
    }
    ok(res, row);
  }),
);

gdprRouter.get(
  '/export/mine',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rows = await listExportsForUser(req.user!.id);
    ok(res, rows);
  }),
);

gdprRouter.get(
  '/export/:requestId/download',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const row = await getExportRequest(req.params.requestId!);
    if (!row) {
      err(res, 'NOT_FOUND', 'Export request not found', 404);
      return;
    }
    if (row.userId !== req.user!.id) {
      err(res, 'FORBIDDEN', 'You do not own this export request', 403);
      return;
    }
    if (row.status !== 'READY' && row.status !== 'DOWNLOADED') {
      err(res, 'EXPORT_NOT_READY', `Export is ${row.status}`, 409);
      return;
    }
    if (!row.downloadUrl) {
      err(res, 'DOWNLOAD_UNAVAILABLE', 'Download URL missing', 500);
      return;
    }
    if (row.downloadExpiresAt && row.downloadExpiresAt.getTime() < Date.now()) {
      err(res, 'EXPORT_EXPIRED', 'Download link has expired. Request a new export.', 410);
      return;
    }

    await markDownloaded(row.id);
    ok(res, {
      downloadUrl: row.downloadUrl,
      expiresAt:   row.downloadExpiresAt,
      sizeBytes:   row.fileSizeBytes,
    });
  }),
);

// ── Consent routes ───────────────────────────────────────────────────────────

gdprRouter.get(
  '/consent/my',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rows = await getActiveConsents(req.user!.id);
    ok(res, rows);
  }),
);

gdprRouter.post(
  '/consent',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = ConsentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    const row = await recordConsent({
      userId:         req.user!.id,
      consentType:    parsed.data.consent_type,
      consentVersion: parsed.data.consent_version,
      consentGiven:   parsed.data.consent_given,
      ipAddress:      getClientIp(req),
      userAgent:      getUserAgent(req),
    });
    ok(res, row, 201);
  }),
);

gdprRouter.delete(
  '/consent/:type',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const typeParam = req.params.type as ConsentType;
    if (!CONSENT_TYPES.includes(typeParam as typeof CONSENT_TYPES[number])) {
      err(res, 'VALIDATION_ERROR', 'Unknown consent type', 400);
      return;
    }
    const row = await withdrawConsent({
      userId:      req.user!.id,
      consentType: typeParam,
      ipAddress:   getClientIp(req),
      userAgent:   getUserAgent(req),
    });
    ok(res, row);
  }),
);
