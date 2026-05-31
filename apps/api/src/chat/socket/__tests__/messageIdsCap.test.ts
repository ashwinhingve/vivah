import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Namespace, Socket } from 'socket.io'

// P0 item 7 — mark_read / delivered_ack must Zod-validate messageIds as a
// non-empty array capped at 100. Oversized payloads are rejected (no DB work);
// exactly-100 still passes. Standalone file (mirrors handlers.test.ts mocks).

const { mockFindOne, mockFindOneAndUpdate, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockUpdateOne: vi.fn(),
}))

vi.mock('../../../infrastructure/mongo/models/Chat.js', () => ({
  Chat: { findOne: mockFindOne, findOneAndUpdate: mockFindOneAndUpdate, updateOne: mockUpdateOne },
}))

vi.mock('../../../lib/env.js', () => {
  const env = { USE_MOCK_SERVICES: false, MONGO_LIVE: false, NODE_ENV: 'test' }
  return {
    env,
    get shouldUseMockMongo() { return env.USE_MOCK_SERVICES && !env.MONGO_LIVE },
  }
})

vi.mock('../../../lib/mockStore.js', () => ({
  mockGet: vi.fn(() => null),
}))

vi.mock('../../../infrastructure/redis/queues.js', () => ({
  notificationsQueue: { add: vi.fn() },
}))

vi.mock('../../../lib/profile.js', () => ({
  resolveProfileId: vi.fn(async () => 'prof-self'),
}))

vi.mock('../presence.js', () => ({
  markOnline: vi.fn(async () => {}),
  markOffline: vi.fn(async () => {}),
}))

vi.mock('../linkPreview.js', () => ({
  extractFirstUrl: vi.fn(() => null),
  fetchLinkPreview: vi.fn(async () => null),
}))

type Handler = (payload: unknown) => void | Promise<void>

interface FakeSocket {
  id: string
  handlers: Map<string, Handler>
  rooms: Set<string>
  join: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  to: ReturnType<typeof vi.fn>
  on: (event: string, handler: Handler) => void
}

function makeSocket(rooms: string[] = []): FakeSocket {
  const handlers = new Map<string, Handler>()
  const socket: FakeSocket = {
    id: 'sock-1',
    handlers,
    rooms: new Set(['sock-1', ...rooms]),
    join: vi.fn((room: string) => { socket.rooms.add(room) }),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    on: (event, handler) => { handlers.set(event, handler) },
  }
  return socket
}

function makeNamespace(): Namespace {
  const ns = {
    to: vi.fn(() => ({ emit: vi.fn() })),
    emit: vi.fn(),
    adapter: { rooms: new Map() },
  }
  return ns as unknown as Namespace
}

async function getHandler(event: string, rooms: string[] = []): Promise<{
  handler: Handler
  socket: FakeSocket
  ns: Namespace
}> {
  const { registerChatHandlers } = await import('../handlers.js')
  const socket = makeSocket(rooms)
  const ns = makeNamespace()
  registerChatHandlers(ns, socket as unknown as Socket)
  return { handler: socket.handlers.get(event)!, socket, ns }
}

const participantDoc = { matchRequestId: 'm1', participants: ['prof-self', 'prof-other'] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('messageIds cap-100 validation', () => {
  it('mark_read drops messageIds arrays longer than 100', async () => {
    mockFindOne.mockResolvedValueOnce(participantDoc)
    const { handler } = await getHandler('mark_read')
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    await handler({ matchRequestId: 'm1', messageIds: ids })
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('mark_read accepts exactly 100 messageIds', async () => {
    mockFindOne.mockResolvedValueOnce(participantDoc)
    const { handler } = await getHandler('mark_read')
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`)
    await handler({ matchRequestId: 'm1', messageIds: ids })
    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
  })

  it('mark_read drops an empty messageIds array', async () => {
    mockFindOne.mockResolvedValueOnce(participantDoc)
    const { handler } = await getHandler('mark_read')
    await handler({ matchRequestId: 'm1', messageIds: [] })
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('delivered_ack drops messageIds arrays longer than 100', async () => {
    mockFindOne.mockResolvedValueOnce(participantDoc)
    const { handler } = await getHandler('delivered_ack')
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    await handler({ matchRequestId: 'm1', messageIds: ids })
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('delivered_ack accepts exactly 100 messageIds', async () => {
    mockFindOne.mockResolvedValueOnce(participantDoc)
    const { handler } = await getHandler('delivered_ack')
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`)
    await handler({ matchRequestId: 'm1', messageIds: ids })
    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
  })

  it('mark_read rejects non-string messageIds', async () => {
    mockFindOne.mockResolvedValueOnce(participantDoc)
    const { handler } = await getHandler('mark_read')
    await handler({ matchRequestId: 'm1', messageIds: [1, 2, 3] })
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })
})
