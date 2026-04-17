/**
 * Smart Shaadi — Match Requests Router
 *
 * Mounted at: /api/v1/matchmaking/requests
 *
 * POST   /requests              → sendRequest
 * PUT    /requests/:id/accept   → acceptRequest
 * PUT    /requests/:id/decline  → declineRequest
 * DELETE /requests/:id          → withdrawRequest
 * POST   /block/:profileId      → blockUser
 * POST   /report/:profileId     → reportUser
 * GET    /requests/received     → getReceivedRequests
 * GET    /requests/sent         → getSentRequests
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../auth/middleware.js';
import { ok, err } from '../../lib/response.js';
import {
  sendRequest,
  acceptRequest,
  declineRequest,
  withdrawRequest,
  blockUser,
  reportUser,
  getReceivedRequests,
  getSentRequests,
  type ServiceError,
} from './service.js';

export const matchRequestsRouter = Router();

// ── Zod schemas ───────────────────────────────────────────────────────────────

const SendRequestBody = z.object({
  receiverId: z.string().uuid('receiverId must be a valid UUID'),
  message:    z.string().max(500).optional(),
});

const ReportBody = z.object({
  reason: z.string().min(1).max(1000),
});

const PaginationQuery = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Error handler ─────────────────────────────────────────────────────────────

function handleServiceError(res: Response, error: unknown): void {
  const e = error as ServiceError;
  if (e.code) {
    const statusMap: Record<string, number> = {
      SELF_REQUEST:       400,
      BLOCKED:            403,
      DUPLICATE_REQUEST:  409,
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
  err(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
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

    const senderId = req.user!.id;
    const { receiverId, message } = parsed.data;

    try {
      const request = await sendRequest(senderId, receiverId, message);
      ok(res, { request }, 201);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

// ── GET /requests/received ────────────────────────────────────────────────────
// Must be declared BEFORE /requests/:id/* to prevent param capture

matchRequestsRouter.get(
  '/requests/received',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query params', 400);
      return;
    }

    const userId = req.user!.id;
    const { page, limit } = parsed.data;

    try {
      const result = await getReceivedRequests(userId, page, limit);
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

    const userId = req.user!.id;
    const { page, limit } = parsed.data;

    try {
      const result = await getSentRequests(userId, page, limit);
      ok(res, result);
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
    if (!requestId) {
      err(res, 'VALIDATION_ERROR', 'Missing request id', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const request = await acceptRequest(userId, requestId);
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
    if (!requestId) {
      err(res, 'VALIDATION_ERROR', 'Missing request id', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const request = await declineRequest(userId, requestId);
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
    if (!requestId) {
      err(res, 'VALIDATION_ERROR', 'Missing request id', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      const request = await withdrawRequest(userId, requestId);
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
    if (!targetProfileId) {
      err(res, 'VALIDATION_ERROR', 'Missing profileId', 400);
      return;
    }

    const userId = req.user!.id;

    try {
      await blockUser(userId, targetProfileId);
      ok(res, { blocked: true });
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
    if (!targetProfileId) {
      err(res, 'VALIDATION_ERROR', 'Missing profileId', 400);
      return;
    }

    const parsed = ReportBody.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }

    const userId = req.user!.id;
    const { reason } = parsed.data;

    try {
      await reportUser(userId, targetProfileId, reason);
      ok(res, { reported: true });
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);
