import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { env } from '../../lib/env.js'
import { registerChatHandlers } from './handlers.js'
import { authenticateHandshake } from './auth.js'
import { corsOriginDelegate } from '../../lib/cors.js'
import { setNotificationEmitter } from '../../notifications/realtime.js'
import type { NotificationEvent } from '@smartshaadi/types'

let ioInstance: Server | null = null
let socketAdapterKind: 'redis' | 'memory' = 'memory'

export function getIO(): Server | null {
  return ioInstance
}

export function getSocketAdapterKind(): 'redis' | 'memory' {
  return socketAdapterKind
}

/**
 * Push a notification to every open tab of a user over the /notifications
 * namespace. No-op if the socket server hasn't booted. Called by the
 * notifications delivery worker after the in-app row is persisted.
 */
export function emitNotificationToUser(userId: string, event: NotificationEvent): void {
  const io = getIO()
  if (!io) return
  io.of('/notifications').to(`user:${userId}`).emit('notification_received', event)
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
  const io = new Server(server, {
    // Same allowlist delegate as the Express app (lib/cors.ts) — exact
    // prod/dev origins + Vercel preview URLs — so REST and socket CORS never
    // drift. credentials:true carries the session cookie cross-origin.
    cors: {
      origin: corsOriginDelegate,
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

  // Verify the Better Auth session on the handshake — accepts either the
  // explicit auth.token or the raw Cookie header (cross-origin withCredentials
  // path). See authenticateHandshake() in ./auth.ts for the full rationale.
  chat.use(async (socket, next) => {
    const userId = await authenticateHandshake(socket.handshake)
    if (!userId) return next(new Error('Unauthorized'))
    socket.data['userId'] = userId
    next()
  })

  chat.on('connection', (socket) => {
    registerChatHandlers(chat, socket)
  })

  // Dedicated per-user notification channel. Kept separate from /chat so
  // notification sockets never run the chat presence/handler machinery, and
  // rooms are keyed by Better Auth userId — which works for ALL roles,
  // including vendors/admins/coordinators that have no `profiles` row. Rooms
  // are per-namespace, so `user:${userId}` here never collides with /chat's
  // `user:${profileId}` rooms. Inherits the Redis adapter already set on `io`.
  const notif = io.of('/notifications')
  notif.use(async (socket, next) => {
    const userId = await authenticateHandshake(socket.handshake)
    if (!userId) return next(new Error('Unauthorized'))
    socket.data['userId'] = userId
    next()
  })
  notif.on('connection', (socket) => {
    socket.join(`user:${socket.data['userId'] as string}`)
  })

  // Register the realtime transport with the delivery worker (which never
  // imports this module — see notifications/realtime.ts for why).
  setNotificationEmitter(emitNotificationToUser)

  return io
}
