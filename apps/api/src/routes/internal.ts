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
import { Router, type Request, type Response } from 'express';
import { Chat } from '../infrastructure/mongo/models/Chat.js';
import { env } from '../lib/env.js';
import { ok, err } from '../lib/response.js';
import { asyncHandler } from '../lib/asyncHandler.js';

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
