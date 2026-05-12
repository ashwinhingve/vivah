/**
 * Matrimony AI Assistant route — POST /api/v1/assistant/chat
 *
 * Requires Better Auth session. Per-user rate limit (60/hr). Builds the
 * RAG context server-side, forwards the SSE stream from the ai-service
 * straight to the client. SSE framing comes from the ai-service — this
 * handler is a transparent pipe with a typed JSON error fallback if the
 * upstream is down before any bytes are flushed.
 *
 * NOT mounted in routes/ai.ts (P2-owned during this sprint) — separate
 * router file by design. Wired in routes/_p3Register.ts.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { err } from '../lib/response.js';
import { env } from '../lib/env.js';
import { redis } from '../lib/redis.js';
import { resolveProfileId } from '../lib/profile.js';
import { buildAssistantContext } from '../services/assistantContext.js';
import { openAssistantStream, type AssistantUpstream } from '../services/assistantService.js';

export const assistantRouter = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const AssistantChatSchema = z.object({
  message:         z.string().trim().min(1).max(2000),
  conversation_id: z.string().uuid().nullable().optional(),
});

// ── Rate limit (60/hr per user) ───────────────────────────────────────────────

const ASSISTANT_RATE_LIMIT = 60;
const ASSISTANT_RATE_WINDOW_SEC = 3600;

async function checkAssistantRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) {
    return { allowed: true, remaining: ASSISTANT_RATE_LIMIT - 1 };
  }
  const key = `assistant:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ASSISTANT_RATE_WINDOW_SEC);
    const remaining = Math.max(0, ASSISTANT_RATE_LIMIT - count);
    return { allowed: count <= ASSISTANT_RATE_LIMIT, remaining };
  } catch {
    return { allowed: true, remaining: 0 };
  }
}

// ── POST /chat ────────────────────────────────────────────────────────────────

assistantRouter.post(
  '/chat',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const { allowed, remaining } = await checkAssistantRateLimit(userId);
    if (!allowed) {
      res.setHeader('X-RateLimit-Limit', ASSISTANT_RATE_LIMIT);
      res.setHeader('X-RateLimit-Remaining', 0);
      err(res, 'RATE_LIMIT_EXCEEDED', 'Too many assistant requests. Try again later.', 429);
      return;
    }
    res.setHeader('X-RateLimit-Limit', ASSISTANT_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);

    const parsed = AssistantChatSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    const { message, conversation_id } = parsed.data;

    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }

    const context = await buildAssistantContext(userId, profileId);

    let upstream: AssistantUpstream;
    try {
      upstream = await openAssistantStream({
        user_id:         userId,
        profile_id:      profileId,
        message,
        conversation_id: conversation_id ?? null,
        context,
      });
    } catch {
      err(res, 'AI_SERVICE_UNAVAILABLE', 'Assistant temporarily unavailable', 503);
      return;
    }

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const reader = upstream.body.getReader();
    let aborted = false;
    req.on('close', () => {
      aborted = true;
      reader.cancel().catch(() => {});
    });

    try {
      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } catch {
      // upstream cut off mid-stream — fall through to end()
    } finally {
      if (!aborted) res.end();
    }
  }),
);
