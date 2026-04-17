import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { env } from '../../lib/env.js'
import { registerChatHandlers } from './handlers.js'

interface JwtPayload {
  userId: string
  profileId?: string
}

export function initSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: env.WEB_URL, credentials: true },
  })

  const chat = io.of('/chat')

  chat.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined
    if (!token) return next(new Error('Unauthorized'))
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
      socket.data['userId'] = payload.userId
      socket.data['profileId'] = payload.profileId ?? null
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  chat.on('connection', (socket) => {
    registerChatHandlers(chat, socket)
  })

  return io
}
