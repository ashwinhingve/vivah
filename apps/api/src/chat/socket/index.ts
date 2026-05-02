import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { auth } from '../../auth/config.js'
import { env } from '../../lib/env.js'
import { registerChatHandlers } from './handlers.js'

let ioInstance: Server | null = null

export function getIO(): Server | null {
  return ioInstance
}

async function attachRedisAdapter(io: Server): Promise<void> {
  if (!env.REDIS_URL) return
  try {
    const pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true })
    const subClient = pubClient.duplicate()
    await Promise.all([pubClient.connect(), subClient.connect()])
    io.adapter(createAdapter(pubClient, subClient))
    console.log('[socket] Redis adapter attached — multi-instance broadcast enabled')
  } catch (err) {
    console.warn('[socket] Redis adapter unavailable, falling back to in-memory:', err)
  }
}

export function initSocket(server: HttpServer): Server {
  const allowedOrigins = env.NODE_ENV === 'production'
    ? [
        process.env['CORS_ORIGIN'] ?? env.WEB_URL,
        'https://smartshaadi.co.in',
        'https://www.smartshaadi.co.in',
      ]
    : [env.WEB_URL, 'http://localhost:3000']

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  ioInstance = io

  // Attach Redis adapter for cross-instance broadcast (best-effort).
  void attachRedisAdapter(io)

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
