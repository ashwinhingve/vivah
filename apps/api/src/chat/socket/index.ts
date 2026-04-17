import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { auth } from '../../auth/config.js'
import { env } from '../../lib/env.js'
import { registerChatHandlers } from './handlers.js'

export function initSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: env.WEB_URL, credentials: true },
  })

  const chat = io.of('/chat')

  // Verify Better Auth session cookie passed from client handshake
  chat.use(async (socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined
    if (!token) return next(new Error('Unauthorized'))
    try {
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: `better-auth.session_token=${token}` }),
      })
      if (!session?.user) return next(new Error('Unauthorized'))
      socket.data['userId'] = session.user.id
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
