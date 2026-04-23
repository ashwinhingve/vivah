import { Router, type Request, type Response } from 'express'
import { authenticate } from '../auth/middleware.js'
import { Chat } from '../infrastructure/mongo/models/Chat.js'
import { env } from '../lib/env.js'
import { ok, err } from '../lib/response.js'
import { getPresignedUploadUrl } from '../storage/service.js'
import { resolveProfileId } from '../lib/profile.js'
import { asyncHandler } from '../lib/asyncHandler.js'

const router = Router()

/**
 * Chat.participants stores profile UUIDs. All queries here resolve the caller's
 * userId → profileId first.
 */
async function requireProfileId(req: Request, res: Response): Promise<string | null> {
  const profileId = await resolveProfileId(req.user!.id)
  if (!profileId) {
    err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404)
    return null
  }
  return profileId
}

// GET /api/v1/chat/conversations
router.get(
  '/conversations',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    if (env.USE_MOCK_SERVICES) {
      ok(res, [])
      return
    }

    try {
      const conversations = await Chat.find({ participants: profileId })
        .select('matchRequestId participants lastMessage isActive updatedAt')
        .sort({ updatedAt: -1 })
        .lean()
      ok(res, conversations)
    } catch {
      err(res, 'INTERNAL_ERROR', 'Failed to fetch conversations', 500)
    }
  }),
)

// GET /api/v1/chat/conversations/:matchId
router.get(
  '/conversations/:matchId',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const page = Math.max(1, Number(req.query['page']) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query['limit']) || 50))

    if (env.USE_MOCK_SERVICES) {
      ok(res, { messages: [], total: 0 }, 200, { page, limit })
      return
    }

    try {
      const chat = await Chat.findOne({
        matchRequestId: matchId,
        participants: profileId,
      }).lean()

      if (!chat) {
        err(res, 'NOT_FOUND', 'Conversation not found', 404)
        return
      }

      const total = chat.messages.length
      const sorted = [...chat.messages].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      )
      const messages = sorted.slice((page - 1) * limit, page * limit)
      ok(res, { messages, total }, 200, { page, limit })
    } catch {
      err(res, 'INTERNAL_ERROR', 'Failed to fetch messages', 500)
    }
  }),
)

// POST /api/v1/chat/conversations/:matchId/photos
router.post(
  '/conversations/:matchId/photos',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const { fileName, mimeType } = req.body as { fileName?: unknown; mimeType?: unknown }

    if (
      typeof fileName !== 'string' ||
      !fileName.trim() ||
      typeof mimeType !== 'string' ||
      !mimeType.startsWith('image/')
    ) {
      err(res, 'VALIDATION_ERROR', 'fileName and a valid image mimeType are required', 400)
      return
    }

    if (!env.USE_MOCK_SERVICES) {
      try {
        const chat = await Chat.findOne({
          matchRequestId: matchId,
          participants: profileId,
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
  }),
)

export { router as chatRouter }
