import type { Namespace, Socket } from 'socket.io'
import { Chat } from '../../infrastructure/mongo/models/Chat.js'
import { env } from '../../lib/env.js'

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
    // TODO: enqueue Bull notification job if receiver is not in room (Phase 2)
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
            $set: {
              'messages.$[msg].readAt': new Date(),
              'messages.$[msg].readBy': userId,
            },
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
