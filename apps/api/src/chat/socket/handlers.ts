import type { Namespace, Socket } from 'socket.io'
import { Queue } from 'bullmq'
import { Chat } from '../../infrastructure/mongo/models/Chat.js'
import { env } from '../../lib/env.js'
import { mockGet } from '../../lib/mockStore.js'

const notificationsQueue = new Queue('notifications', {
  connection: {
    url: env.REDIS_URL,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null as unknown as number,
  },
})

export function registerChatHandlers(io: Namespace, socket: Socket): void {
  const userId = socket.data['userId'] as string

  // ── join_room ────────────────────────────────────────────────────────────────
  socket.on('join_room', async ({ matchRequestId }: { matchRequestId: string }) => {
    if (env.USE_MOCK_SERVICES) {
      socket.join(matchRequestId)
      return
    }
    try {
      const chat = await Chat.findOne({ matchRequestId })
      if (!chat || !chat.participants.includes(userId)) {
        socket.emit('error', { message: 'Not a participant' })
        return
      }
      socket.join(matchRequestId)
    } catch (err) {
      console.error('[socket] join_room error:', err)
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
    const sentAt = new Date()
    const message = {
      senderId: userId,
      content,
      type,
      photoKey: photoKey ?? null,
      sentAt,
      readAt: null as Date | null,
      readBy: [] as string[],
    }

    if (!env.USE_MOCK_SERVICES) {
      try {
        await Chat.findOneAndUpdate(
          { matchRequestId, participants: userId },
          {
            $push: { messages: message },
            $set: {
              lastMessage: {
                content,
                sentAt,
                senderId: userId,
              },
            },
          },
        )
      } catch (err) {
        console.error('[socket] send_message persist error:', err)
        socket.emit('error', { message: 'Failed to save message' })
        return
      }
    }

    io.to(matchRequestId).emit('message_received', {
      ...message,
      _id: Date.now().toString(),
      sentAt: sentAt.toISOString(),
      readAt: null,
      contentHi: null,
      contentEn: null,
    })

    // Notify receiver if they are not currently in the room
    try {
      let participants: string[] = []
      if (env.USE_MOCK_SERVICES) {
        const stored = mockGet(matchRequestId)
        const chat = stored?.['chat'] as { participants?: string[] } | undefined
        participants = chat?.participants ?? []
      } else {
        const chat = await Chat.findOne({ matchRequestId }).select('participants').lean()
        participants = (chat?.participants as string[] | undefined) ?? []
      }
      const receiverId = participants.find((p) => p !== userId)
      if (receiverId) {
        const socketsInRoom = await io.in(matchRequestId).fetchSockets()
        const receiverInRoom = socketsInRoom.some((s) => s.data['userId'] === receiverId)
        if (!receiverInRoom) {
          void notificationsQueue.add(
            'NEW_CHAT_MESSAGE',
            { type: 'push', userId: receiverId, data: { matchRequestId } },
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
    if (!env.USE_MOCK_SERVICES) {
      try {
        await Chat.updateOne(
          { matchRequestId },
          {
            $set: { 'messages.$[msg].readAt': new Date() },
            $addToSet: { 'messages.$[msg].readBy': userId },
          },
          { arrayFilters: [{ 'msg._id': { $in: messageIds } }] },
        )
      } catch (err) {
        console.error('[socket] mark_read error:', err)
      }
    }
    io.to(matchRequestId).emit('message_read', { messageIds, readBy: userId })
  })

  // ── typing ───────────────────────────────────────────────────────────────────
  socket.on('typing', ({ matchRequestId }: { matchRequestId: string }) => {
    socket.to(matchRequestId).emit('user_typing', { userId })
  })
}
