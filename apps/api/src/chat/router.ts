import { Router, type Request, type Response } from 'express'
import { authenticate } from '../auth/middleware.js'
import { Chat } from '../infrastructure/mongo/models/Chat.js'
import { env } from '../lib/env.js'
import { ok, err } from '../lib/response.js'
import { getPresignedUploadUrl } from '../storage/service.js'

const router = Router()

/**
 * GET /api/v1/chat/conversations
 * List all conversations for the authenticated user.
 */
router.get(
  '/conversations',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id

    if (env.USE_MOCK_SERVICES) {
      ok(res, [])
      return
    }

    try {
      const conversations = await Chat.find({ participants: userId })
        .select('matchRequestId participants lastMessage isActive updatedAt')
        .sort({ updatedAt: -1 })
        .lean()
      ok(res, conversations)
    } catch {
      err(res, 'INTERNAL_ERROR', 'Failed to fetch conversations', 500)
    }
  },
)

/**
 * GET /api/v1/chat/conversations/:matchId
 * Full message history for a conversation, paginated newest-first.
 */
router.get(
  '/conversations/:matchId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id
    const { matchId } = req.params as { matchId: string }
    const page = Math.max(1, Number(req.query['page']) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query['limit']) || 50))

    if (env.USE_MOCK_SERVICES) {
      res.json({
        success: true,
        data: { messages: [], total: 0 },
        error: null,
        meta: { page, limit, timestamp: new Date().toISOString() },
      })
      return
    }

    try {
      // Guard: only participants can read this conversation
      const chat = await Chat.findOne({
        matchRequestId: matchId,
        participants: userId,
      }).lean()

      if (!chat) {
        err(res, 'NOT_FOUND', 'Conversation not found', 404)
        return
      }

      const total = chat.messages.length
      const sorted = [...chat.messages].sort(
        (a, b) =>
          new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      )
      const messages = sorted.slice((page - 1) * limit, page * limit)

      res.json({
        success: true,
        data: { messages, total },
        error: null,
        meta: { page, limit, timestamp: new Date().toISOString() },
      })
    } catch {
      err(res, 'INTERNAL_ERROR', 'Failed to fetch messages', 500)
    }
  },
)

/**
 * POST /api/v1/chat/conversations/:matchId/photos
 * Get a pre-signed R2 PUT URL for uploading a chat photo.
 * Body: { fileName: string; mimeType: string }
 */
router.post(
  '/conversations/:matchId/photos',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id
    const { matchId } = req.params as { matchId: string }
    const { fileName, mimeType } = req.body as {
      fileName?: unknown
      mimeType?: unknown
    }

    if (
      typeof fileName !== 'string' ||
      !fileName.trim() ||
      typeof mimeType !== 'string' ||
      !mimeType.startsWith('image/')
    ) {
      err(res, 'VALIDATION_ERROR', 'fileName and a valid image mimeType are required', 400)
      return
    }

    // Guard: only conversation participants may upload photos
    if (!env.USE_MOCK_SERVICES) {
      try {
        const chat = await Chat.findOne({
          matchRequestId: matchId,
          participants: userId,
        }).lean()

        if (!chat) {
          err(res, 'NOT_FOUND', 'Conversation not found', 404)
          return
        }
      } catch {
        err(res, 'INTERNAL_ERROR', 'Failed to verify conversation', 500)
        return
      }
    }

    try {
      const { uploadUrl, r2Key } = await getPresignedUploadUrl(
        `chat/${matchId}`,
        fileName,
        mimeType,
      )
      ok(res, { uploadUrl, key: r2Key })
    } catch {
      err(res, 'INTERNAL_ERROR', 'Failed to generate upload URL', 500)
    }
  },
)

export { router as chatRouter }
