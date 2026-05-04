import type { Namespace, Socket } from 'socket.io'
import { Chat } from '../../infrastructure/mongo/models/Chat.js'
import { env } from '../../lib/env.js'
import { mockGet } from '../../lib/mockStore.js'
import { notificationsQueue } from '../../infrastructure/redis/queues.js'
import { resolveProfileId } from '../../lib/profile.js'
import { markOnline, markOffline } from '../presence.js'
import { extractFirstUrl, fetchLinkPreview } from '../linkPreview.js'

const ALLOWED_REACTIONS = new Set(['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '🎉'])
const EDIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const DELETE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

interface ChatMessageDoc {
  _id:           { toString: () => string }
  senderId:      string
  content:       string
  type:          'TEXT' | 'PHOTO' | 'VOICE' | 'SYSTEM'
  photoKey?:     string | null
  voiceKey?:     string | null
  voiceDuration?: number | null
  sentAt:        Date
  readAt?:       Date | null
  readBy?:       string[]
  deliveredTo?:  string[]
  reactions?:    Array<{ profileId: string; emoji: string; at: Date }>
  replyTo?:      { messageId: string; senderId: string; type: string; preview: string } | null
  forwardedFrom?: { matchRequestId: string; senderId: string } | null
  linkPreview?:  unknown
  editedAt?:     Date | null
  deletedAt?:    Date | null
}

function previewFor(msg: { content: string; type: string }): string {
  if (msg.type === 'PHOTO') return '📷 Photo'
  if (msg.type === 'VOICE') return '🎙️ Voice note'
  if (msg.type === 'SYSTEM') return msg.content
  return msg.content.slice(0, 80)
}

export function registerChatHandlers(io: Namespace, socket: Socket): void {
  const userId = socket.data['userId'] as string
  let cachedProfileId: string | null | undefined

  async function getProfileId(): Promise<string | null> {
    if (cachedProfileId !== undefined) return cachedProfileId
    cachedProfileId = await resolveProfileId(userId)
    if (cachedProfileId) {
      void markOnline(cachedProfileId)
      // Per-user room receives conversation_updated pushes regardless of
      // which conversation room the socket has currently joined.
      socket.join(`user:${cachedProfileId}`)
      // No global presence broadcast on connect — leaks profileId of every
      // online user to every other socket. Presence is emitted to each
      // conversation room from `join_room` instead.
    }
    return cachedProfileId
  }

  function emitPresenceToActiveRooms(payload: { profileId: string; isOnline: boolean; lastSeenAt: string | null }): void {
    const ownUserRoom = `user:${payload.profileId}`
    for (const room of socket.rooms) {
      // socket.rooms includes the auto-room socket.id and the per-user room;
      // skip both — only fan out to conversation rooms the socket has joined.
      if (room === socket.id || room === ownUserRoom) continue
      socket.to(room).emit('presence_update', payload)
    }
  }

  function emitConversationUpdated(
    matchRequestId: string,
    participants: string[],
    payload: Record<string, unknown>,
  ): void {
    for (const pid of participants) {
      io.to(`user:${pid}`).emit('conversation_updated', {
        matchRequestId,
        ...payload,
      })
    }
  }

  // Eagerly mark online on connect.
  void getProfileId()

  // Heartbeat every 30s extends presence TTL (60s).
  const heartbeat = setInterval(() => {
    if (cachedProfileId) void markOnline(cachedProfileId)
  }, 30_000)

  socket.on('disconnect', async () => {
    clearInterval(heartbeat)
    if (cachedProfileId) {
      await markOffline(cachedProfileId)
      // Only notify rooms this socket was actually a participant in — never
      // global broadcast.
      emitPresenceToActiveRooms({
        profileId:  cachedProfileId,
        isOnline:   false,
        lastSeenAt: new Date().toISOString(),
      })
    }
  })

  async function loadParticipants(matchRequestId: string): Promise<string[]> {
    if (env.USE_MOCK_SERVICES) {
      const stored = mockGet(matchRequestId)
      const chat = stored?.['chat'] as { participants?: string[] } | undefined
      return chat?.participants ?? []
    }
    const chat = await Chat.findOne({ matchRequestId })
    return (chat?.participants as string[] | undefined) ?? []
  }

  async function assertParticipant(matchRequestId: string): Promise<string | null> {
    const profileId = await getProfileId()
    if (!profileId) {
      socket.emit('error', { message: 'Profile not found' })
      return null
    }
    const participants = await loadParticipants(matchRequestId)
    if (!participants.includes(profileId)) {
      socket.emit('error', { message: 'Not a participant' })
      return null
    }
    return profileId
  }

  // ── join_room ────────────────────────────────────────────────────────────────
  socket.on('join_room', async ({ matchRequestId }: { matchRequestId: string }) => {
    try {
      const profileId = await assertParticipant(matchRequestId)
      if (!profileId) return
      socket.join(matchRequestId)
      socket.emit('presence_update', {
        profileId, isOnline: true, lastSeenAt: null,
      })
    } catch (e) {
      console.error('[socket] join_room error:', e)
      socket.emit('error', { message: 'Internal error' })
    }
  })

  socket.on('leave_room', ({ matchRequestId }: { matchRequestId: string }) => {
    socket.leave(matchRequestId)
  })

  socket.on('presence_ping', () => {
    if (cachedProfileId) void markOnline(cachedProfileId)
  })

  // ── send_message ─────────────────────────────────────────────────────────────
  socket.on('send_message', async ({
    matchRequestId,
    content,
    type,
    photoKey,
    voiceKey,
    voiceDuration,
    replyToId,
  }: {
    matchRequestId: string
    content: string
    type: 'TEXT' | 'PHOTO' | 'VOICE'
    photoKey?: string
    voiceKey?: string
    voiceDuration?: number
    replyToId?: string
  }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return

    if (typeof content !== 'string' || content.length === 0 || content.length > 4000) {
      socket.emit('error', { message: 'Invalid message content' })
      return
    }

    const sentAt = new Date()

    let replyTo: { messageId: string; senderId: string; type: string; preview: string } | null = null
    if (replyToId && !env.USE_MOCK_SERVICES) {
      try {
        const src = await Chat.findOne({ matchRequestId })
          .select('messages._id messages.senderId messages.content messages.type messages.deletedAt')
          .lean()
        const found = (src?.messages as unknown as ChatMessageDoc[] | undefined)?.find(
          (m) => String(m._id) === replyToId && !m.deletedAt,
        )
        if (found) {
          replyTo = {
            messageId: String(found._id),
            senderId:  found.senderId,
            type:      found.type,
            preview:   previewFor(found),
          }
        }
      } catch {
        /* ignore — reply context optional */
      }
    }

    let linkPreview = null
    if (type === 'TEXT') {
      const url = extractFirstUrl(content)
      if (url) {
        try { linkPreview = await fetchLinkPreview(url) } catch { /* ignore */ }
      }
    }

    const message = {
      senderId:      profileId,
      content,
      type,
      photoKey:      photoKey ?? null,
      voiceKey:      voiceKey ?? null,
      voiceDuration: voiceDuration ?? null,
      sentAt,
      readAt:        null as Date | null,
      readBy:        [] as string[],
      deliveredTo:   [] as string[],
      reactions:     [] as Array<{ profileId: string; emoji: string; at: Date }>,
      replyTo,
      forwardedFrom: null,
      linkPreview,
      editedAt:      null as Date | null,
      deletedAt:     null as Date | null,
    }

    let savedId: string | null = null
    if (!env.USE_MOCK_SERVICES) {
      try {
        const updated = await Chat.findOneAndUpdate(
          { matchRequestId, participants: profileId },
          {
            $push: { messages: message },
            $set: {
              lastMessage: { content, sentAt, senderId: profileId, type },
            },
          },
          { new: true },
        )
        if (!updated) { socket.emit('error', { message: 'Conversation not found' }); return }
        const msgs = (updated.messages as unknown as ChatMessageDoc[] | undefined) ?? []
        const last = msgs[msgs.length - 1]
        savedId = last ? String(last._id) : null
      } catch (e) {
        console.error('[socket] send_message persist error:', e)
        socket.emit('error', { message: 'Failed to save message' })
        return
      }
    }

    io.to(matchRequestId).emit('message_received', {
      ...message,
      _id: savedId ?? Date.now().toString(),
      sentAt: sentAt.toISOString(),
      readAt: null,
      contentHi: null,
      contentEn: null,
    })

    // Push lightweight update to each participant's user room so the
    // /chats list reflects last-message + unread without a refresh.
    try {
      const partsForUpdate = await loadParticipants(matchRequestId)
      emitConversationUpdated(matchRequestId, partsForUpdate, {
        kind:    'last_message',
        lastMessage: {
          content:  previewFor({ content, type }),
          sentAt:   sentAt.toISOString(),
          senderId: profileId,
          type,
        },
      })
    } catch { /* best-effort */ }

    // Notify receiver if not in room
    try {
      const participants = await loadParticipants(matchRequestId)
      const receiverProfileId = participants.find((p) => p !== profileId)
      if (receiverProfileId) {
        const socketsInRoom = await io.in(matchRequestId).fetchSockets()
        const receiverInRoom = await Promise.all(
          socketsInRoom.map(async (s) => {
            const uid = s.data['userId'] as string | undefined
            if (!uid) return false
            const pid = await resolveProfileId(uid)
            return pid === receiverProfileId
          }),
        ).then((flags) => flags.some(Boolean))

        if (!receiverInRoom) {
          void notificationsQueue.add(
            'NEW_CHAT_MESSAGE',
            {
              userId:  receiverProfileId,
              type:    'NEW_CHAT_MESSAGE',
              payload: { matchRequestId },
            },
            { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
          )
        }
      }
    } catch (notifyErr) {
      console.error('[socket] send_message notification error:', notifyErr)
    }
  })

  // ── edit_message ─────────────────────────────────────────────────────────────
  socket.on('edit_message', async ({
    matchRequestId, messageId, content,
  }: { matchRequestId: string; messageId: string; content: string }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return
    if (typeof content !== 'string' || !content.trim() || content.length > 4000) {
      socket.emit('error', { message: 'Invalid edit content' }); return
    }
    if (env.USE_MOCK_SERVICES) return

    try {
      const chat = await Chat.findOne({ matchRequestId })
      if (!chat) { socket.emit('error', { message: 'Conversation not found' }); return }
      const target = (chat.messages as unknown as ChatMessageDoc[]).find(
        (m) => String(m._id) === messageId,
      )
      if (!target) { socket.emit('error', { message: 'Message not found' }); return }
      if (target.senderId !== profileId) { socket.emit('error', { message: 'Forbidden' }); return }
      if (target.type !== 'TEXT') { socket.emit('error', { message: 'Only text messages can be edited' }); return }
      if (target.deletedAt) { socket.emit('error', { message: 'Message is deleted' }); return }
      if (Date.now() - new Date(target.sentAt).getTime() > EDIT_WINDOW_MS) {
        socket.emit('error', { message: 'Edit window has passed' }); return
      }
      const editedAt = new Date()
      await Chat.updateOne(
        { matchRequestId, 'messages._id': target._id },
        { $set: { 'messages.$.content': content, 'messages.$.editedAt': editedAt } },
      )
      io.to(matchRequestId).emit('message_edited', {
        messageId, content, editedAt: editedAt.toISOString(),
      })
    } catch (e) {
      console.error('[socket] edit_message error:', e)
      socket.emit('error', { message: 'Edit failed' })
    }
  })

  // ── delete_message ───────────────────────────────────────────────────────────
  socket.on('delete_message', async ({
    matchRequestId, messageId,
  }: { matchRequestId: string; messageId: string }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return
    if (env.USE_MOCK_SERVICES) return

    try {
      const chat = await Chat.findOne({ matchRequestId })
      if (!chat) { socket.emit('error', { message: 'Conversation not found' }); return }
      const target = (chat.messages as unknown as ChatMessageDoc[]).find(
        (m) => String(m._id) === messageId,
      )
      if (!target) { socket.emit('error', { message: 'Message not found' }); return }
      if (target.senderId !== profileId) { socket.emit('error', { message: 'Forbidden' }); return }
      if (target.deletedAt) return
      if (Date.now() - new Date(target.sentAt).getTime() > DELETE_WINDOW_MS) {
        socket.emit('error', { message: 'Delete window has passed' }); return
      }
      const deletedAt = new Date()
      await Chat.updateOne(
        { matchRequestId, 'messages._id': target._id },
        {
          $set: {
            'messages.$.deletedAt': deletedAt,
            'messages.$.content':   '[deleted]',
            'messages.$.linkPreview': null,
          },
        },
      )
      io.to(matchRequestId).emit('message_deleted', {
        messageId, deletedAt: deletedAt.toISOString(),
      })
    } catch (e) {
      console.error('[socket] delete_message error:', e)
      socket.emit('error', { message: 'Delete failed' })
    }
  })

  // ── react_message / unreact_message ──────────────────────────────────────────
  socket.on('react_message', async ({
    matchRequestId, messageId, emoji,
  }: { matchRequestId: string; messageId: string; emoji: string }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return
    if (!ALLOWED_REACTIONS.has(emoji)) {
      socket.emit('error', { message: 'Reaction not allowed' }); return
    }
    if (env.USE_MOCK_SERVICES) return

    try {
      // Replace any existing reaction by this profile, then add new one.
      await Chat.updateOne(
        { matchRequestId, 'messages._id': messageId },
        { $pull: { 'messages.$.reactions': { profileId } } },
      )
      const at = new Date()
      const result = await Chat.findOneAndUpdate(
        { matchRequestId, 'messages._id': messageId },
        { $push: { 'messages.$.reactions': { profileId, emoji, at } } },
        { new: true },
      ).lean()
      const updated = (result?.messages as unknown as ChatMessageDoc[] | undefined)?.find(
        (m) => String(m._id) === messageId,
      )
      io.to(matchRequestId).emit('message_reacted', {
        messageId,
        reactions: (updated?.reactions ?? []).map((r) => ({
          profileId: r.profileId,
          emoji:     r.emoji,
          at:        new Date(r.at).toISOString(),
        })),
      })
    } catch (e) {
      console.error('[socket] react_message error:', e)
      socket.emit('error', { message: 'Reaction failed' })
    }
  })

  socket.on('unreact_message', async ({
    matchRequestId, messageId,
  }: { matchRequestId: string; messageId: string }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return
    if (env.USE_MOCK_SERVICES) return

    try {
      const result = await Chat.findOneAndUpdate(
        { matchRequestId, 'messages._id': messageId },
        { $pull: { 'messages.$.reactions': { profileId } } },
        { new: true },
      ).lean()
      const updated = (result?.messages as unknown as ChatMessageDoc[] | undefined)?.find(
        (m) => String(m._id) === messageId,
      )
      io.to(matchRequestId).emit('message_reacted', {
        messageId,
        reactions: (updated?.reactions ?? []).map((r) => ({
          profileId: r.profileId,
          emoji:     r.emoji,
          at:        new Date(r.at).toISOString(),
        })),
      })
    } catch (e) {
      console.error('[socket] unreact_message error:', e)
    }
  })

  // ── delivered_ack — receiver-side delivery confirmation ──────────────────────
  socket.on('delivered_ack', async ({
    matchRequestId, messageIds,
  }: { matchRequestId: string; messageIds: string[] }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return
    if (!Array.isArray(messageIds) || messageIds.length === 0) return
    if (env.USE_MOCK_SERVICES) {
      io.to(matchRequestId).emit('message_delivered', { messageIds, profileId })
      return
    }

    try {
      await Chat.updateOne(
        { matchRequestId },
        { $addToSet: { 'messages.$[msg].deliveredTo': profileId } },
        { arrayFilters: [{ 'msg._id': { $in: messageIds } }] },
      )
      io.to(matchRequestId).emit('message_delivered', { messageIds, profileId })
    } catch (e) {
      console.error('[socket] delivered_ack error:', e)
    }
  })

  // ── mark_read ────────────────────────────────────────────────────────────────
  socket.on('mark_read', async ({
    matchRequestId, messageIds,
  }: { matchRequestId: string; messageIds: string[] }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return

    const readAt = new Date()
    if (!env.USE_MOCK_SERVICES) {
      try {
        await Chat.updateOne(
          { matchRequestId },
          {
            $set: { 'messages.$[msg].readAt': readAt },
            $addToSet: {
              'messages.$[msg].readBy':      profileId,
              'messages.$[msg].deliveredTo': profileId,
            },
          },
          { arrayFilters: [{ 'msg._id': { $in: messageIds } }] },
        )
      } catch (e) {
        console.error('[socket] mark_read error:', e)
      }
    }
    io.to(matchRequestId).emit('message_read', {
      messageIds,
      readBy:  profileId,
      readAt:  readAt.toISOString(),
    })

    // Reset reader's unread count in /chats list.
    try {
      const parts = await loadParticipants(matchRequestId)
      emitConversationUpdated(matchRequestId, [profileId], {
        kind: 'unread_cleared',
      })
      void parts
    } catch { /* best-effort */ }
  })

  // ── typing ───────────────────────────────────────────────────────────────────
  socket.on('typing', ({ matchRequestId }: { matchRequestId: string }) => {
    const profileId = cachedProfileId ?? ''
    // userId (Better Auth) must never leave the server boundary — only
    // profileId is the public identifier seen by other participants.
    socket.to(matchRequestId).emit('user_typing', { profileId })
  })
}
