import type { Namespace, Socket } from 'socket.io'
import { Chat } from '../../infrastructure/mongo/models/Chat.js'
import { env } from '../../lib/env.js'
import { mockGet } from '../../lib/mockStore.js'
import { notificationsQueue } from '../../infrastructure/redis/queues.js'
import { resolveProfileId } from '../../lib/profile.js'

/**
 * Chat.participants stores profile UUIDs (sourced from match_requests senderId/
 * receiverId, which are profile IDs). Incoming sockets authenticate with a
 * Better Auth userId, so every participant check must first resolve the userId
 * to its profileId. Resolution is cached per-socket to avoid a DB hit per event.
 */
export function registerChatHandlers(io: Namespace, socket: Socket): void {
  const userId = socket.data['userId'] as string
  let cachedProfileId: string | null | undefined

  async function getProfileId(): Promise<string | null> {
    if (cachedProfileId !== undefined) return cachedProfileId
    cachedProfileId = await resolveProfileId(userId)
    return cachedProfileId
  }

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
    } catch (e) {
      console.error('[socket] join_room error:', e)
      socket.emit('error', { message: 'Internal error' })
    }
  })

  // ── send_message ─────────────────────────────────────────────────────────────
  socket.on('send_message', async ({
    matchRequestId,
    content,
    type,
    photoKey,
  }: {
    matchRequestId: string
    content: string
    type: 'TEXT' | 'PHOTO'
    photoKey?: string
  }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return

    const sentAt = new Date()
    const message = {
      senderId: profileId,
      content,
      type,
      photoKey: photoKey ?? null,
      sentAt,
      readAt: null as Date | null,
      readBy: [] as string[],
    }

    if (!env.USE_MOCK_SERVICES) {
      try {
        const updated = await Chat.findOneAndUpdate(
          { matchRequestId, participants: profileId },
          {
            $push: { messages: message },
            $set: {
              lastMessage: {
                content,
                sentAt,
                senderId: profileId,
              },
            },
          },
        )
        if (!updated) {
          socket.emit('error', { message: 'Conversation not found' })
          return
        }
      } catch (e) {
        console.error('[socket] send_message persist error:', e)
        socket.emit('error', { message: 'Failed to save message' })
        return
      }
    }

    io.to(matchRequestId).emit('message_received', {
      ...message,
      _id: Date.now().toString(),
      sentAt: sentAt.toISOString(),
      readAt: null,
      // TODO(phase-3): enqueue translation via AI service (/ai/translate).
      contentHi: null,
      contentEn: null,
    })

    // Notify receiver if they are not currently in the room
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

  // ── mark_read ────────────────────────────────────────────────────────────────
  socket.on('mark_read', async ({
    matchRequestId,
    messageIds,
  }: {
    matchRequestId: string
    messageIds: string[]
  }) => {
    const profileId = await assertParticipant(matchRequestId)
    if (!profileId) return

    if (!env.USE_MOCK_SERVICES) {
      try {
        await Chat.updateOne(
          { matchRequestId },
          {
            $set: { 'messages.$[msg].readAt': new Date() },
            $addToSet: { 'messages.$[msg].readBy': profileId },
          },
          { arrayFilters: [{ 'msg._id': { $in: messageIds } }] },
        )
      } catch (e) {
        console.error('[socket] mark_read error:', e)
      }
    }
    io.to(matchRequestId).emit('message_read', { messageIds, readBy: profileId })
  })

  // ── typing ───────────────────────────────────────────────────────────────────
  socket.on('typing', ({ matchRequestId }: { matchRequestId: string }) => {
    socket.to(matchRequestId).emit('user_typing', { userId })
  })
}
