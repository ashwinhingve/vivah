import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { auth } from '../../auth/config.js'
import { env } from '../../lib/env.js'
import { registerChatHandlers } from './handlers.js'

let ioInstance: Server | null = null
let socketAdapterKind: 'redis' | 'memory' = 'memory'

export function getIO(): Server | null {
  return ioInstance
}

export function getSocketAdapterKind(): 'redis' | 'memory' {
  return socketAdapterKind
}

async function attachRedisAdapter(io: Server): Promise<void> {
  if (!env.REDIS_URL) {
    console.error('[CHAT-SOCKET-CRITICAL] REDIS_URL not set — sockets running in-memory only. Cross-instance message delivery will fail on Railway with >1 replica.')
    return
  }
  try {
    const pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, family: 0 })
    const subClient = pubClient.duplicate()
    await Promise.all([pubClient.connect(), subClient.connect()])
    io.adapter(createAdapter(pubClient, subClient))
    socketAdapterKind = 'redis'
    console.log('[socket] Redis adapter attached — multi-instance broadcast enabled')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CHAT-SOCKET-CRITICAL] Redis adapter failed to attach — falling back to in-memory. Cross-instance messages will not deliver. Error:', msg)
  }
}

export async function initSocket(server: HttpServer): Promise<Server> {
  // Mirrors apps/api/src/index.ts CORS allowlist; sourced from typed env
  // (env.CORS_ORIGIN previously read via raw process.env — bypassed schema).
  const allowedOrigins =
    env.NODE_ENV === 'production'
      ? [env.CORS_ORIGIN, env.WEB_URL, 'https://smartshaadi.co.in', 'https://www.smartshaadi.co.in']
          .filter((o): o is string => Boolean(o))
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
  // Awaited so the adapter is ready before the '/chat' namespace starts
  // accepting connections — avoids a startup race where early messages
  // broadcast only in-memory and miss other instances.
  await attachRedisAdapter(io)

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
