/**
 * Smart Shaadi — Match Requests Router
 *
 * Mounted at: /api/v1/matchmaking/requests
 *
 * POST   /requests                  → sendRequest (priority + message)
 * GET    /requests/received         → list received (paginated)
 * GET    /requests/sent             → list sent (paginated)
 * GET    /requests/enriched         → enriched feed (received|sent)
 * PUT    /requests/:id/seen         → markRequestSeen
 * PUT    /requests/:id/accept       → acceptRequest (welcomeMessage)
 * PUT    /requests/:id/decline      → declineRequest (reason)
 * DELETE /requests/:id              → withdrawRequest
 * POST   /block/:profileId          → blockUser (reason)
 * DELETE /block/:profileId          → unblockUser
 * GET    /blocks                    → listBlockedUsers
 * POST   /report/:profileId         → reportUser (category + details)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { authenticate } from '../../auth/middleware.js';
import { db } from '../../lib/db.js';
import { ok, err } from '../../lib/response.js';
import { getProfileTier } from '../../lib/entitlements.js';
import { checkAndConsumeInterestQuota } from '../../lib/quotas.js';
import {
  sendRequest,
  acceptRequest,
  declineRequest,
  withdrawRequest,
  markRequestSeen,
  blockUser,
  unblockUser,
  listBlockedUsers,
  reportUser,
  getReceivedRequests,
  getSentRequests,
  getEnrichedRequests,
  type ServiceError,
} from './service.js';

export const matchRequestsRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const SendRequestBody = z.object({
  receiverId: z.string().uuid('receiverId must be a valid UUID'),
  message:    z.string().max(500).optional(),
  priority:   z.enum(['NORMAL', 'SUPER_LIKE']).optional(),
});

const AcceptBody = z.object({
  welcomeMessage: z.string().max(500).optional(),
}).optional();

const DeclineBody = z.object({
  reason: z.enum([
    'NOT_INTERESTED', 'NOT_MATCHING_PREFERENCES', 'INCOMPLETE_PROFILE',
    'PHOTO_HIDDEN', 'INAPPROPRIATE_MESSAGE', 'OTHER',
  ]).optional(),
}).optional();

const ReportBody = z.object({
  category: z.enum([
    'HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT',
    'SCAM', 'UNDERAGE', 'SPAM', 'OTHER',
  ]),
  details:   z.string().max(1000).optional(),
  requestId: z.string().uuid().optional(),
});

const BlockBody = z.object({
  reason: z.string().max(500).optional(),
}).optional();

const PaginationQuery = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const EnrichedQuery = z.object({
  side:  z.enum(['received', 'sent']).default('received'),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Error mapper ──────────────────────────────────────────────────────────────

function handleServiceError(res: Response, error: unknown): void {
  const e = error as ServiceError;
  if (e.code) {
    const statusMap: Record<string, number> = {
      SELF_REQUEST:       400,
      SELF_BLOCK:         400,
      SELF_REPORT:        400,
      BLOCKED:            403,
      DUPLICATE_REQUEST:  409,
      ALREADY_MATCHED:    409,
      COOLDOWN_ACTIVE:    409,
      NOT_FOUND:          404,
      FORBIDDEN:          403,
      INVALID_STATUS:     409,
      INSERT_FAILED:      500,
      UPDATE_FAILED:      500,
    };
    const status = statusMap[e.code] ?? 400;
    err(res, e.code, e.message, status);
    return;
  }
  console.error('[matchRequestsRouter] unexpected error:', error);
  err(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

async function resolveProfileId(userId: string): Promise<string | null> {
  const [row] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row?.id ?? null;
}

// ── POST /requests ─────────────────────────────────────────────────────────────

matchRequestsRouter.post(
  '/requests',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SendRequestBody.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }

    const resolved = await getProfileTier(req.user!.id);
    if (!resolved) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }

    const { receiverId, message, priority = 'NORMAL' } = parsed.data;

    if (priority === 'SUPER_LIKE' && resolved.tier === 'FREE') {
      err(res, 'TIER_REQUIRED', 'Super Like is available on STANDARD and PREMIUM plans', 402);
      return;
    }

    // SUPER_LIKE bypasses daily quota; NORMAL consumes it.
    let quota: { used: number; limit: number; remaining: number } | null = null;
    if (priority === 'NORMAL') {
      const q = await checkAndConsumeInterestQuota(resolved.profileId, resolved.tier);
      if (!q.allowed) {
        res.status(429).json({
          success: false,
          data: null,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Daily interest limit reached (${q.limit}/day on ${resolved.tier}). Upgrade for more.`,
            upgradeRequired: true,
            requiredTier: resolved.tier === 'FREE' ? 'STANDARD' : 'PREMIUM',
            feature: 'daily_interest_quota',
            quota: { used: q.used, limit: q.limit, remaining: 0 },
          },
          meta: { timestamp: new Date().toISOString() },
        });
        return;
      }
      quota = {
        used: q.used,
        limit: Number.isFinite(q.limit) ? q.limit : Number.POSITIVE_INFINITY,
        remaining: Number.isFinite(q.remaining) ? q.remaining : Number.POSITIVE_INFINITY,
      };
    }

    try {
      const request = await sendRequest(resolved.profileId, receiverId, { message, priority });
      ok(res, {
        request,
        quota: quota
          ? {
              used: quota.used,
              limit: Number.isFinite(quota.limit) ? quota.limit : null,
              remaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
            }
          : null,
      }, 201);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── GET /requests/received ────────────────────────────────────────────────────

matchRequestsRouter.get(
  '/requests/received',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query params', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const result = await getReceivedRequests(profileId, parsed.data.page, parsed.data.limit);
      ok(res, result);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── GET /requests/sent ────────────────────────────────────────────────────────

matchRequestsRouter.get(
  '/requests/sent',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query params', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const result = await getSentRequests(profileId, parsed.data.page, parsed.data.limit);
      ok(res, result);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── GET /requests/enriched ────────────────────────────────────────────────────

matchRequestsRouter.get(
  '/requests/enriched',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = EnrichedQuery.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query params', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const result = await getEnrichedRequests(profileId, parsed.data.side, parsed.data.page, parsed.data.limit);
      ok(res, result);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── GET /blocks ────────────────────────────────────────────────────────────────

matchRequestsRouter.get(
  '/blocks',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const blocks = await listBlockedUsers(profileId);
      ok(res, { blocks, total: blocks.length });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── PUT /requests/:id/seen ────────────────────────────────────────────────────

matchRequestsRouter.put(
  '/requests/:id/seen',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.params['id'];
    if (!requestId) { err(res, 'VALIDATION_ERROR', 'Missing request id', 400); return; }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const request = await markRequestSeen(profileId, requestId);
      ok(res, { request });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── PUT /requests/:id/accept ──────────────────────────────────────────────────

matchRequestsRouter.put(
  '/requests/:id/accept',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.params['id'];
    if (!requestId) { err(res, 'VALIDATION_ERROR', 'Missing request id', 400); return; }
    const parsed = AcceptBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const request = await acceptRequest(profileId, requestId, parsed.data ?? {});
      ok(res, { request });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── PUT /requests/:id/decline ─────────────────────────────────────────────────

matchRequestsRouter.put(
  '/requests/:id/decline',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.params['id'];
    if (!requestId) { err(res, 'VALIDATION_ERROR', 'Missing request id', 400); return; }
    const parsed = DeclineBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const request = await declineRequest(profileId, requestId, parsed.data ?? {});
      ok(res, { request });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── DELETE /requests/:id ──────────────────────────────────────────────────────

matchRequestsRouter.delete(
  '/requests/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.params['id'];
    if (!requestId) { err(res, 'VALIDATION_ERROR', 'Missing request id', 400); return; }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const request = await withdrawRequest(profileId, requestId);
      ok(res, { request });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── POST /block/:profileId ─────────────────────────────────────────────────────

matchRequestsRouter.post(
  '/block/:profileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetProfileId = req.params['profileId'];
    if (!targetProfileId) { err(res, 'VALIDATION_ERROR', 'Missing profileId', 400); return; }
    const parsed = BlockBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      await blockUser(profileId, targetProfileId, parsed.data?.reason);
      ok(res, { blocked: true });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── DELETE /block/:profileId ──────────────────────────────────────────────────

matchRequestsRouter.delete(
  '/block/:profileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetProfileId = req.params['profileId'];
    if (!targetProfileId) { err(res, 'VALIDATION_ERROR', 'Missing profileId', 400); return; }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      await unblockUser(profileId, targetProfileId);
      ok(res, { unblocked: true });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── POST /report/:profileId ───────────────────────────────────────────────────

matchRequestsRouter.post(
  '/report/:profileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetProfileId = req.params['profileId'];
    if (!targetProfileId) { err(res, 'VALIDATION_ERROR', 'Missing profileId', 400); return; }
    const parsed = ReportBody.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) { err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404); return; }
    try {
      const result = await reportUser(profileId, targetProfileId, parsed.data);
      ok(res, { reportId: result.reportId, reported: true }, 201);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);
