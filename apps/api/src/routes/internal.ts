/**
 * Internal API routes — NOT protected by Better Auth session middleware.
 *
 * These endpoints are for service-to-service communication only (e.g. the
 * Python AI service calling back into the Node API to read chat history).
 * They are authenticated via the shared X-Internal-Key header.
 *
 * Mount in index.ts: app.use('/internal', internalRouter)
 * IMPORTANT: mount BEFORE express.json() body parser is irrelevant here, but
 * DO NOT attach the authenticate() middleware to this router.
 */
import { createHash } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Chat } from '../infrastructure/mongo/models/Chat.js';
import { env } from '../lib/env.js';
import { ok, err } from '../lib/response.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { redis } from '../lib/redis.js';
import { resolveProfileId } from '../lib/profile.js';
import { ASSISTANT_TOOLS, isKnownTool } from '../services/assistantTools.js';

export const internalRouter = Router();

/** Middleware: verify X-Internal-Key header matches AI_SERVICE_INTERNAL_KEY. */
function requireInternalKey(req: Request, res: Response, next: () => void): void {
  const key = req.headers['x-internal-key'];
  if (!key || key !== env.AI_SERVICE_INTERNAL_KEY) {
    err(res, 'FORBIDDEN', 'Invalid or missing internal key', 403);
    return;
  }
  next();
}

internalRouter.use(requireInternalKey);

/**
 * GET /internal/chat/:matchId/messages?limit=20
 *
 * Returns the last N messages from a chat conversation, sorted ascending by
 * sentAt. Used by the AI service to fetch conversation history for the
 * Conversation Coach feature.
 *
 * Response shape:
 *   { success: true, data: { messages: Message[], matchId: string } }
 *
 * Message shape:
 *   { sender: "A" | "B", text: string, timestamp: string }
 *   where A = first participant in chat.participants[], B = second.
 */
internalRouter.get(
  '/chat/:matchId/messages',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { matchId } = req.params as { matchId: string };

    // Parse + clamp limit (default 20, max 50)
    const rawLimit = Number(req.query['limit'] ?? '20');
    const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20));

    // Mock mode: return canned messages so dev/test works without MongoDB.
    if (env.USE_MOCK_SERVICES) {
      const MOCK_MESSAGES = [
        { sender: 'A' as const, text: 'Namaste! How are you?', timestamp: new Date(Date.now() - 300_000).toISOString() },
        { sender: 'B' as const, text: 'Namaste! I am good, thank you. And you?', timestamp: new Date(Date.now() - 240_000).toISOString() },
        { sender: 'A' as const, text: 'Doing well! I noticed we share an interest in classical music.', timestamp: new Date(Date.now() - 180_000).toISOString() },
      ];
      ok(res, { messages: MOCK_MESSAGES.slice(0, limit), matchId });
      return;
    }

    try {
      const chat = await Chat.findOne({ matchRequestId: matchId })
        .select('participants messages.senderId messages.content messages.type messages.sentAt messages.deletedAt')
        .lean();

      if (!chat) {
        // Return empty — caller (AI service) can handle gracefully.
        ok(res, { messages: [], matchId });
        return;
      }

      const [participantA, participantB] = chat.participants as string[];

      type RawMsg = {
        senderId: string;
        content: string;
        type: string;
        sentAt: Date;
        deletedAt?: Date | null;
      };

      const allMessages = (chat.messages as unknown as RawMsg[])
        .filter((m) => !m.deletedAt && m.type === 'TEXT')
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      // Take last `limit` messages (most recent N, still sorted asc)
      const sliced = allMessages.slice(-limit);

      const messages = sliced.map((m) => ({
        sender: m.senderId === participantA ? 'A' : (m.senderId === participantB ? 'B' : 'A'),
        text: m.content,
        timestamp: new Date(m.sentAt).toISOString(),
      }));

      ok(res, { messages, matchId });
    } catch (e) {
      console.error('[internal/chat/:matchId/messages] error:', e);
      err(res, 'INTERNAL_ERROR', 'Failed to fetch messages', 500);
    }
  }),
);

/**
 * POST /internal/assistant/tool
 *
 * Tool-execution bridge for the AI assistant agent loop (which runs in the
 * Python ai-service). The ai-service asks us to run a named, user-authorized
 * tool; we re-resolve the userId->profileId server-side (defense in depth —
 * never trust the profileId the caller sent), dispatch to an allow-listed
 * handler that wraps an existing user-filtered service function, and return
 * the redacted result.
 *
 * Body: { userId, profileId, toolName, args }
 * Response: standard { success, data, error } envelope.
 */
const AssistantToolSchema = z.object({
  userId: z.string().min(1),
  profileId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.record(z.unknown()).optional(),
});

// Short per-tool cache TTLs (seconds). This is live data — TTLs only absorb
// bursts within a single multi-round agent turn. Unread/chat feel near-real-time.
const TOOL_CACHE_TTL: Record<string, number> = {
  get_my_profile: 30,
  get_my_matches: 60,
  get_pending_requests: 30,
  get_who_liked_me: 60,
  get_match_status: 30,
  list_conversations: 10,
  get_unread_count: 10,
  list_weddings: 30,
  get_wedding_budget: 30,
  get_wedding_tasks: 30,
  get_wedding_ceremonies: 60,
  suggest_muhurat_dates: 300,
};

// Backstop rate limit protecting against a runaway ai-service loop. The primary
// control is ASSISTANT_MAX_TOOL_ROUNDS in the ai-service itself.
const TOOL_RATE_LIMIT = 120;
const TOOL_RATE_WINDOW_SEC = 3600;

async function checkToolRateLimit(userId: string): Promise<boolean> {
  if (env.NODE_ENV === 'test' || env.USE_MOCK_SERVICES) return true;
  const key = `internal:assistant-tool:rl:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, TOOL_RATE_WINDOW_SEC);
    return count <= TOOL_RATE_LIMIT;
  } catch {
    return true; // fail-open on redis error — availability over the backstop
  }
}

function argsHash(args: unknown): string {
  return createHash('sha1').update(JSON.stringify(args ?? {})).digest('hex').slice(0, 16);
}

internalRouter.post(
  '/assistant/tool',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = AssistantToolSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    const { userId, profileId: claimedProfileId, toolName, args } = parsed.data;

    if (!isKnownTool(toolName)) {
      err(res, 'TOOL_NOT_FOUND', `Unknown tool: ${toolName}`, 400);
      return;
    }

    // Authz (defense in depth): re-derive profileId; never trust the caller's.
    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }
    if (profileId !== claimedProfileId) {
      err(res, 'FORBIDDEN', 'Profile mismatch', 403);
      return;
    }

    if (!(await checkToolRateLimit(userId))) {
      err(res, 'RATE_LIMIT_EXCEEDED', 'Too many tool calls', 429);
      return;
    }

    const cacheKey = `assistant:tool:${toolName}:${profileId}:${argsHash(args)}`;
    const ttl = TOOL_CACHE_TTL[toolName] ?? 30;

    // Cache read (best-effort).
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        ok(res, JSON.parse(cached) as unknown);
        return;
      }
    } catch {
      /* redis down — fall through to live execution */
    }

    try {
      const runner = ASSISTANT_TOOLS[toolName]!;
      const data = await runner(args ?? {}, { userId, profileId });

      // Cache write (best-effort).
      try {
        await redis.setex(cacheKey, ttl, JSON.stringify(data));
      } catch {
        /* ignore cache write failure */
      }

      ok(res, data as unknown);
    } catch (e) {
      // ZodError (bad args from the model) or a handler failure — the ai-service
      // turns any non-2xx into an isolated is_error tool result the LLM sees.
      const message = e instanceof Error ? e.message : 'Tool execution failed';
      console.error(`[internal/assistant/tool] ${toolName} error:`, message);
      err(res, 'TOOL_EXECUTION_ERROR', 'Tool execution failed', 502);
    }
  }),
);
