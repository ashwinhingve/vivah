/**
 * Video router — Daily.co rooms + meeting scheduler.
 * All routes require authentication.
 * Mount in index.ts: app.use('/api/v1/video', videoRouter)
 */

import { Router, type Request, type Response } from 'express';
import { authenticate }       from '../auth/middleware.js';
import { ok, err }            from '../lib/response.js';
import { CreateVideoRoomSchema, ScheduleMeetingSchema, RespondMeetingSchema } from '@smartshaadi/schemas';
import {
  createVideoRoom,
  endVideoRoom,
  getActiveRoom,
  scheduleMeeting,
  respondMeeting,
  getMeetings,
} from './service.js';

const router = Router();

// ── Error helper ──────────────────────────────────────────────────────────────

interface AppError extends Error {
  code?: string;
  status?: number;
}

function handleError(res: Response, e: unknown, fallbackMsg: string): void {
  const appErr = e as AppError;
  const code   = appErr.code   ?? 'INTERNAL_ERROR';
  const status = appErr.status ?? 500;
  const msg    = appErr.message ?? fallbackMsg;
  err(res, code, msg, status);
}

// ── POST /rooms ───────────────────────────────────────────────────────────────

router.post(
  '/rooms',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateVideoRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }
    try {
      const room = await createVideoRoom(req.user!.id, parsed.data);
      ok(res, room, 201);
    } catch (e) {
      handleError(res, e, 'Failed to create video room');
    }
  },
);

// ── GET /rooms/:matchId ───────────────────────────────────────────────────────
// FIX 1: Return existing active room for a match from Redis, or 404 if none.

router.get(
  '/rooms/:matchId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { matchId } = req.params as { matchId: string };
    try {
      const room = await getActiveRoom(req.user!.id, matchId);
      if (!room) {
        err(res, 'NOT_FOUND', 'No active room for this match', 404);
        return;
      }
      ok(res, room);
    } catch (e) {
      handleError(res, e, 'Failed to get active room');
    }
  },
);

// ── DELETE /rooms/:roomName ───────────────────────────────────────────────────

router.delete(
  '/rooms/:roomName',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { roomName } = req.params as { roomName: string };
    const { matchId }  = req.body as { matchId?: unknown };

    if (typeof matchId !== 'string' || !matchId) {
      err(res, 'VALIDATION_ERROR', 'matchId is required in body', 422);
      return;
    }
    try {
      const result = await endVideoRoom(req.user!.id, roomName, matchId);
      ok(res, result);
    } catch (e) {
      handleError(res, e, 'Failed to end video room');
    }
  },
);

// ── POST /meetings ────────────────────────────────────────────────────────────

router.post(
  '/meetings',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ScheduleMeetingSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }
    try {
      const meeting = await scheduleMeeting(req.user!.id, parsed.data);
      ok(res, meeting, 201);
    } catch (e) {
      handleError(res, e, 'Failed to schedule meeting');
    }
  },
);

// ── PUT /meetings/:matchId/:meetingId ─────────────────────────────────────────

router.put(
  '/meetings/:matchId/:meetingId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { matchId, meetingId } = req.params as { matchId: string; meetingId: string };
    const parsed = RespondMeetingSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422);
      return;
    }
    try {
      const meeting = await respondMeeting(req.user!.id, matchId, meetingId, parsed.data);
      ok(res, meeting);
    } catch (e) {
      handleError(res, e, 'Failed to respond to meeting');
    }
  },
);

// ── GET /meetings/:matchId ────────────────────────────────────────────────────

router.get(
  '/meetings/:matchId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { matchId } = req.params as { matchId: string };
    try {
      const meetings = await getMeetings(req.user!.id, matchId);
      ok(res, meetings);
    } catch (e) {
      handleError(res, e, 'Failed to fetch meetings');
    }
  },
);

export { router as videoRouter };
