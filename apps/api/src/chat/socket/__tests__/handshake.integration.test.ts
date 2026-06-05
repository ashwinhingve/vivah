import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createServer, type Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server } from 'socket.io'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'

// Better Auth getSession is stubbed: any cookie header containing `valid`
// resolves to a user; anything else is an invalid/no session. This lets us
// drive the REAL chat.use middleware over a real socket transport without a DB.
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))
vi.mock('../../../auth/config.js', () => ({
  auth: { api: { getSession: mockGetSession } },
}))
mockGetSession.mockImplementation(async ({ headers }: { headers: Headers }) => {
  const cookie = headers.get('cookie') ?? ''
  return cookie.includes('valid') ? { user: { id: 'user-xyz' } } : null
})

import { authenticateHandshake } from '../auth.js'

let httpServer: HttpServer
let io: Server
let port: number

beforeAll(async () => {
  httpServer = createServer()
  io = new Server(httpServer, { cors: { origin: true, credentials: true } })
  const chat = io.of('/chat')

  // Identical wiring to src/chat/socket/index.ts initSocket().
  chat.use(async (socket, next) => {
    const userId = await authenticateHandshake(socket.handshake)
    if (!userId) return next(new Error('Unauthorized'))
    socket.data['userId'] = userId
    next()
  })

  chat.on('connection', (socket) => {
    // Stand-in for a post-auth chat event (send_message / load history): proves
    // data flows once the handshake authenticates, and that socket.data.userId
    // is populated for participant resolution.
    socket.on('echo', (payload: unknown, ack: (r: unknown) => void) => {
      ack({ userId: socket.data['userId'], payload })
    })
  })

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  port = (httpServer.address() as AddressInfo).port
})

afterAll(async () => {
  io.close()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
})

function connect(opts: Parameters<typeof ioc>[1]): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(`http://localhost:${port}/chat`, {
      transports: ['websocket'],
      reconnection: false,
      ...opts,
    })
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', (err) => reject(err))
  })
}

describe('socket handshake auth (real socket transport)', () => {
  it('authenticates via auth.token and round-trips a post-auth event', async () => {
    const socket = await connect({ auth: { token: 'valid-token' } })
    expect(socket.connected).toBe(true)
    const reply = await socket.emitWithAck('echo', { hello: 1 })
    expect(reply).toEqual({ userId: 'user-xyz', payload: { hello: 1 } })
    socket.disconnect()
  })

  it('authenticates via the raw Cookie header when no auth.token is sent (cross-origin withCredentials path)', async () => {
    const socket = await connect({
      extraHeaders: { Cookie: 'better-auth.session_token=valid; other=1' },
    })
    expect(socket.connected).toBe(true)
    const reply = await socket.emitWithAck('echo', 'hi')
    expect(reply).toEqual({ userId: 'user-xyz', payload: 'hi' })
    socket.disconnect()
  })

  it('rejects the handshake with Unauthorized when no credential is supplied', async () => {
    await expect(connect({})).rejects.toThrow('Unauthorized')
  })

  it('rejects the handshake when the session is invalid', async () => {
    await expect(connect({ auth: { token: 'bogus' } })).rejects.toThrow('Unauthorized')
  })
})
