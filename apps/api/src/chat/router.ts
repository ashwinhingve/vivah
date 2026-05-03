import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../auth/middleware.js'
import { Chat } from '../infrastructure/mongo/models/Chat.js'
import { env } from '../lib/env.js'
import { ok, err } from '../lib/response.js'
import { getPresignedUploadUrl } from '../storage/service.js'
import { resolveProfileId } from '../lib/profile.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { listConversations, getParticipantPreview } from './conversations.service.js'
import { generateSmartReplies } from './smartReplies.js'
import { fetchLinkPreview } from './linkPreview.js'
import { callAiService } from '../lib/ai.js'

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

// ── Conversations list ──────────────────────────────────────────────────────────
// GET /api/v1/chat/conversations?filter=all|unread|archived
router.get(
  '/conversations',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const filterRaw = (req.query['filter'] as string | undefined) ?? 'all'
    const filter: 'all' | 'unread' | 'archived' =
      filterRaw === 'unread' || filterRaw === 'archived' ? filterRaw : 'all'

    try {
      const items = await listConversations({ profileId, filter })
      ok(res, { items })
    } catch (e) {
      console.error('[chat/conversations] list error:', e)
      err(res, 'INTERNAL_ERROR', 'Failed to fetch conversations', 500)
    }
  }),
)

// ── Forward targets — caller's other accepted conversations ────────────────────
// GET /api/v1/chat/conversations/forward-targets
router.get(
  '/conversations/forward-targets',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return
    const exclude = (req.query['exclude'] as string | undefined) ?? ''
    if (env.USE_MOCK_SERVICES) { ok(res, []); return }

    try {
      const docs = await Chat.find({ participants: profileId })
        .select('matchRequestId participants updatedAt lastMessage')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean()
      const otherIds = Array.from(new Set(
        docs
          .filter((d) => d.matchRequestId !== exclude)
          .map((d) => d.participants.find((p) => p !== profileId))
          .filter((id): id is string => !!id),
      ))
      const previews = await Promise.all(otherIds.map((id) => getParticipantPreview(id)))
      const previewById = new Map(otherIds.map((id, i) => [id, previews[i]]))
      const targets = docs
        .filter((d) => d.matchRequestId !== exclude)
        .map((d) => {
          const otherId = d.participants.find((p) => p !== profileId) ?? null
          return {
            matchRequestId: d.matchRequestId,
            other:          otherId ? previewById.get(otherId) ?? null : null,
            lastMessage:    d.lastMessage?.content ?? null,
            updatedAt:      d.updatedAt.toISOString(),
          }
        })
      ok(res, targets)
    } catch (e) {
      console.error('[chat/forward-targets] error:', e)
      err(res, 'INTERNAL_ERROR', 'Failed to fetch targets', 500)
    }
  }),
)

// ── Single conversation messages ────────────────────────────────────────────────
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
      ok(res, { messages: [], total: 0, other: null }, 200, { page, limit })
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
      const otherId = chat.participants.find((p) => p !== profileId) ?? null
      const other = otherId ? await getParticipantPreview(otherId) : null
      const settings = {
        muted:     chat.settings?.mutedBy?.includes(profileId)    ?? false,
        archived:  chat.settings?.archivedBy?.includes(profileId) ?? false,
        pinned:    chat.settings?.pinnedBy?.includes(profileId)   ?? false,
        wallpaper: chat.settings?.wallpaper ?? null,
      }
      ok(res, { messages, total, other, settings, hasMore: page * limit < total }, 200, { page, limit })
    } catch (e) {
      console.error('[chat/conversations/:matchId] error:', e)
      err(res, 'INTERNAL_ERROR', 'Failed to fetch messages', 500)
    }
  }),
)

// ── Message search within a conversation ────────────────────────────────────────
// GET /api/v1/chat/conversations/:matchId/search?q=
router.get(
  '/conversations/:matchId/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const q = ((req.query['q'] as string | undefined) ?? '').trim().toLowerCase()
    if (q.length < 2) { ok(res, []); return }

    if (env.USE_MOCK_SERVICES) { ok(res, []); return }

    try {
      const chat = await Chat.findOne({
        matchRequestId: matchId,
        participants: profileId,
      })
        .select('messages')
        .lean()
      if (!chat) { err(res, 'NOT_FOUND', 'Conversation not found', 404); return }

      const matches = (chat.messages as unknown as Array<{
        _id: unknown
        senderId: string
        content: string
        type: string
        sentAt: Date
        deletedAt?: Date | null
      }>)
        .filter((m) => !m.deletedAt && m.type === 'TEXT' && m.content.toLowerCase().includes(q))
        .slice(-50)
        .map((m) => ({
          messageId: String(m._id),
          senderId:  m.senderId,
          content:   m.content,
          sentAt:    m.sentAt.toISOString(),
        }))
      ok(res, matches)
    } catch (e) {
      console.error('[chat/search] error:', e)
      err(res, 'INTERNAL_ERROR', 'Search failed', 500)
    }
  }),
)

// ── Media gallery (photos + voice) ──────────────────────────────────────────────
// GET /api/v1/chat/conversations/:matchId/media
router.get(
  '/conversations/:matchId/media',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    if (env.USE_MOCK_SERVICES) { ok(res, { photos: [], voices: [] }); return }

    try {
      const chat = await Chat.findOne({
        matchRequestId: matchId,
        participants: profileId,
      })
        .select('messages')
        .lean()
      if (!chat) { err(res, 'NOT_FOUND', 'Conversation not found', 404); return }

      type RawMsg = {
        _id: unknown
        type: string
        photoKey?: string | null
        voiceKey?: string | null
        voiceDuration?: number | null
        sentAt: Date
        senderId: string
        deletedAt?: Date | null
      }
      const msgs = chat.messages as unknown as RawMsg[]

      const photos = msgs
        .filter((m) => !m.deletedAt && m.type === 'PHOTO' && m.photoKey)
        .map((m) => ({
          messageId: String(m._id),
          photoKey:  m.photoKey!,
          sentAt:    m.sentAt.toISOString(),
          senderId:  m.senderId,
        }))
        .reverse()

      const voices = msgs
        .filter((m) => !m.deletedAt && m.type === 'VOICE' && m.voiceKey)
        .map((m) => ({
          messageId:     String(m._id),
          voiceKey:      m.voiceKey!,
          voiceDuration: m.voiceDuration ?? null,
          sentAt:        m.sentAt.toISOString(),
          senderId:      m.senderId,
        }))
        .reverse()

      ok(res, { photos, voices })
    } catch (e) {
      console.error('[chat/media] error:', e)
      err(res, 'INTERNAL_ERROR', 'Failed to fetch media', 500)
    }
  }),
)

// ── Photo presign (existing) ────────────────────────────────────────────────────
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
        if (!chat) { err(res, 'NOT_FOUND', 'Conversation not found', 404); return }
      } catch {
        err(res, 'INTERNAL_ERROR', 'Failed to verify conversation', 500); return
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

// ── Voice note presign ─────────────────────────────────────────────────────────
// POST /api/v1/chat/conversations/:matchId/voice
const VoicePresignSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  duration: z.number().int().min(1).max(180),
})
router.post(
  '/conversations/:matchId/voice',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const parsed = VoicePresignSchema.safeParse(req.body)
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', 'Invalid voice presign payload', 400)
      return
    }
    if (!parsed.data.mimeType.startsWith('audio/')) {
      err(res, 'INVALID_MIME', 'mimeType must be audio/*', 400)
      return
    }

    if (!env.USE_MOCK_SERVICES) {
      const chat = await Chat.findOne({
        matchRequestId: matchId,
        participants: profileId,
      }).lean()
      if (!chat) { err(res, 'NOT_FOUND', 'Conversation not found', 404); return }
    }

    try {
      const { uploadUrl, r2Key } = await getPresignedUploadUrl(
        `chat-voice/${matchId}`,
        parsed.data.fileName,
        parsed.data.mimeType,
      )
      ok(res, { uploadUrl, key: r2Key, duration: parsed.data.duration })
    } catch {
      err(res, 'INTERNAL_ERROR', 'Failed to generate upload URL', 500)
    }
  }),
)

// ── Conversation settings (mute / archive / pin / wallpaper) ────────────────────
// PATCH /api/v1/chat/conversations/:matchId/settings
const SettingsSchema = z.object({
  muted:     z.boolean().optional(),
  archived:  z.boolean().optional(),
  pinned:    z.boolean().optional(),
  wallpaper: z.string().nullable().optional(),
})
router.patch(
  '/conversations/:matchId/settings',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const parsed = SettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', 'Invalid settings payload', 400)
      return
    }
    if (env.USE_MOCK_SERVICES) { ok(res, { ...parsed.data }); return }

    const adds: Record<string, string> = {}
    const removes: Record<string, string> = {}
    if (parsed.data.muted !== undefined) {
      ;(parsed.data.muted ? adds : removes)['settings.mutedBy'] = profileId
    }
    if (parsed.data.archived !== undefined) {
      ;(parsed.data.archived ? adds : removes)['settings.archivedBy'] = profileId
    }
    if (parsed.data.pinned !== undefined) {
      ;(parsed.data.pinned ? adds : removes)['settings.pinnedBy'] = profileId
    }

    const update: Record<string, unknown> = {}
    if (Object.keys(adds).length)    update['$addToSet'] = adds
    if (Object.keys(removes).length) update['$pull']     = removes
    if (parsed.data.wallpaper !== undefined) {
      update['$set'] = { 'settings.wallpaper': parsed.data.wallpaper }
    }

    try {
      const updated = await Chat.findOneAndUpdate(
        { matchRequestId: matchId, participants: profileId },
        update,
        { new: true },
      ).lean()
      if (!updated) { err(res, 'NOT_FOUND', 'Conversation not found', 404); return }
      ok(res, {
        muted:     updated.settings?.mutedBy?.includes(profileId)    ?? false,
        archived:  updated.settings?.archivedBy?.includes(profileId) ?? false,
        pinned:    updated.settings?.pinnedBy?.includes(profileId)   ?? false,
        wallpaper: updated.settings?.wallpaper ?? null,
      })
    } catch (e) {
      console.error('[chat/settings] update error:', e)
      err(res, 'INTERNAL_ERROR', 'Failed to update settings', 500)
    }
  }),
)

// ── Forward a message to another conversation ──────────────────────────────────
// POST /api/v1/chat/conversations/:matchId/forward
const ForwardSchema = z.object({
  messageId:        z.string().min(1),
  toMatchRequestId: z.string().min(1),
})
router.post(
  '/conversations/:matchId/forward',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const parsed = ForwardSchema.safeParse(req.body)
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', 'Invalid forward payload', 400)
      return
    }
    if (env.USE_MOCK_SERVICES) { ok(res, { forwarded: true }); return }

    try {
      const source = await Chat.findOne({
        matchRequestId: matchId,
        participants: profileId,
      }).lean()
      if (!source) { err(res, 'NOT_FOUND', 'Source conversation not found', 404); return }

      const dest = await Chat.findOne({
        matchRequestId: parsed.data.toMatchRequestId,
        participants: profileId,
      })
      if (!dest) { err(res, 'NOT_FOUND', 'Destination conversation not found', 404); return }

      const original = (source.messages as unknown as Array<{
        _id: { toString: () => string }
        senderId: string
        content: string
        type: 'TEXT' | 'PHOTO' | 'VOICE' | 'SYSTEM'
        photoKey?: string | null
        voiceKey?: string | null
        voiceDuration?: number | null
        deletedAt?: Date | null
      }>).find((m) => String(m._id) === parsed.data.messageId)
      if (!original || original.deletedAt) {
        err(res, 'NOT_FOUND', 'Source message not found', 404); return
      }

      dest.messages.push({
        senderId:      profileId,
        content:       original.content,
        type:          original.type,
        photoKey:      original.photoKey ?? null,
        voiceKey:      original.voiceKey ?? null,
        voiceDuration: original.voiceDuration ?? null,
        sentAt:        new Date(),
        readBy:        [],
        deliveredTo:   [],
        reactions:     [],
        forwardedFrom: { matchRequestId: matchId, senderId: original.senderId },
      } as never)
      dest.lastMessage = {
        content:  original.content,
        sentAt:   new Date(),
        senderId: profileId,
        type:     original.type,
      } as never
      await dest.save()
      ok(res, { forwarded: true })
    } catch (e) {
      console.error('[chat/forward] error:', e)
      err(res, 'INTERNAL_ERROR', 'Forward failed', 500)
    }
  }),
)

// ── Smart reply suggestions ─────────────────────────────────────────────────────
// GET /api/v1/chat/conversations/:matchId/smart-replies
router.get(
  '/conversations/:matchId/smart-replies',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    if (env.USE_MOCK_SERVICES) {
      ok(res, generateSmartReplies(profileId, []))
      return
    }
    try {
      const chat = await Chat.findOne({
        matchRequestId: matchId,
        participants: profileId,
      })
        .select('messages.senderId messages.content messages.type messages.deletedAt messages.sentAt')
        .lean()
      if (!chat) { err(res, 'NOT_FOUND', 'Conversation not found', 404); return }
      const recent = (chat.messages as unknown as Array<{
        senderId: string; content: string; type: string; deletedAt?: Date | null; sentAt: Date
      }>)
        .filter((m) => !m.deletedAt)
        .slice(-6)
      ok(res, generateSmartReplies(profileId, recent))
    } catch (e) {
      console.error('[chat/smart-replies] error:', e)
      err(res, 'INTERNAL_ERROR', 'Failed to fetch suggestions', 500)
    }
  }),
)

// ── Translate ───────────────────────────────────────────────────────────────────
// POST /api/v1/chat/translate
const TranslateSchema = z.object({
  text:   z.string().min(1).max(2000),
  target: z.enum(['hi', 'en']),
})
router.post(
  '/translate',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = TranslateSchema.safeParse(req.body)
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', 'Invalid translate payload', 400)
      return
    }

    if (env.USE_MOCK_SERVICES) {
      ok(res, { text: parsed.data.text, target: parsed.data.target, mocked: true })
      return
    }

    try {
      const out = await callAiService<{ translated: string }>('/ai/translate', parsed.data)
      ok(res, { text: out.translated, target: parsed.data.target, mocked: false })
    } catch (e) {
      console.error('[chat/translate] AI service error:', e)
      // Graceful degrade — return original text marked untranslated.
      ok(res, { text: parsed.data.text, target: parsed.data.target, mocked: true })
    }
  }),
)

// ── Link preview proxy ──────────────────────────────────────────────────────────
// GET /api/v1/chat/link-preview?url=
router.get(
  '/link-preview',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const url = req.query['url']
    if (typeof url !== 'string' || !url) {
      err(res, 'VALIDATION_ERROR', 'url is required', 400); return
    }
    const preview = await fetchLinkPreview(url)
    ok(res, preview)
  }),
)

// ── Report from chat ────────────────────────────────────────────────────────────
// POST /api/v1/chat/conversations/:matchId/report
const ReportSchema = z.object({
  reason: z.string().min(3).max(1000),
})
router.post(
  '/conversations/:matchId/report',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const profileId = await requireProfileId(req, res)
    if (!profileId) return

    const { matchId } = req.params as { matchId: string }
    const parsed = ReportSchema.safeParse(req.body)
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', 'Reason required', 400); return
    }

    if (env.USE_MOCK_SERVICES) { ok(res, { reported: true }); return }

    try {
      // Soft-flag the conversation. A dedicated moderation table can ingest
      // this later; for now we annotate the chat doc.
      await Chat.updateOne(
        { matchRequestId: matchId, participants: profileId },
        {
          $push: {
            messages: {
              senderId: profileId,
              content:  `[reported] ${parsed.data.reason}`,
              type:     'SYSTEM',
              sentAt:   new Date(),
              readBy:   [],
              deliveredTo: [],
              reactions: [],
            },
          },
        },
      )
      ok(res, { reported: true })
    } catch (e) {
      console.error('[chat/report] error:', e)
      err(res, 'INTERNAL_ERROR', 'Report failed', 500)
    }
  }),
)

export { router as chatRouter }
