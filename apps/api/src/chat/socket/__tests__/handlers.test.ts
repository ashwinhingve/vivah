import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock env ──────────────────────────────────────────────────────────────────
vi.mock('../../../lib/env.js', () => ({
  env: {
    USE_MOCK_SERVICES: false,
    JWT_SECRET: 'test-secret-32-chars-minimum-here',
    WEB_URL: 'http://localhost:3000',
  },
}))

// ── Mock Chat model ───────────────────────────────────────────────────────────
const { mockFindOne, mockFindOneAndUpdate, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockUpdateOne: vi.fn(),
}))

vi.mock('../../../infrastructure/mongo/models/Chat.js', () => ({
  Chat: {
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    updateOne: mockUpdateOne,
  },
}))

// ── Mock profile resolver ─────────────────────────────────────────────────────
// Every chat handler resolves the socket's userId → profileId before any
// participant check. In tests the participants Mongo doc is seeded with the
// same string used as userId, so we return it unchanged.
vi.mock('../../../lib/profile.js', () => ({
  resolveProfileId: vi.fn(async (userId: string) => userId),
  invalidateProfileIdCache: vi.fn(),
}))

vi.mock('../../../infrastructure/redis/queues.js', () => ({
  notificationsQueue: { add: vi.fn() },
}))

// ── Mock mockStore (used for participant check in USE_MOCK_SERVICES=true) ─────
const { mockGetFn } = vi.hoisted(() => ({ mockGetFn: vi.fn() }))
vi.mock('../../../lib/mockStore.js', () => ({
  mockGet: mockGetFn,
  mockUpsertField: vi.fn(),
}))

import { registerChatHandlers } from '../handlers.js'
import { env } from '../../../lib/env.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => Promise<void> | void

function makeSocket(userId: string) {
  const handlers: Record<string, EventHandler> = {}
  const emitted: Array<{ event: string; data: unknown }> = []
  const toEmitted: Array<{ room: string; event: string; data: unknown }> = []

  const socket = {
    data: { userId },
    on(event: string, handler: EventHandler) {
      handlers[event] = handler
    },
    emit(event: string, data: unknown) {
      emitted.push({ event, data })
    },
    to(room: string) {
      return {
        emit(event: string, data: unknown) {
          toEmitted.push({ room, event, data })
        },
      }
    },
    join: vi.fn(),
    _handlers: handlers,
    _emitted: emitted,
    _toEmitted: toEmitted,
  }
  return socket
}

function makeIo() {
  const toEmitted: Array<{ room: string; event: string; data: unknown }> = []
  const io = {
    to(room: string) {
      return {
        emit(event: string, data: unknown) {
          toEmitted.push({ room, event, data })
        },
      }
    },
    _toEmitted: toEmitted,
  }
  return io
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('registerChatHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: USE_MOCK_SERVICES off
    ;(env as { USE_MOCK_SERVICES: boolean }).USE_MOCK_SERVICES = false
    // Default mockStore returns a chat doc with user-1 + user-2 as participants.
    // Tests that need the non-participant branch override per-call.
    mockGetFn.mockReturnValue({ chat: { participants: ['user-1', 'user-2'] } })
    // Default real-mode participant lookup also returns user-1 + user-2. Per-
    // test mockFindOne.mockResolvedValueOnce() overrides this for specific cases.
    mockFindOne.mockResolvedValue({ participants: ['user-1', 'user-2'] })
  })

  describe('join_room', () => {
    it('rejects non-participant (not in Chat.participants)', async () => {
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      // Chat found but user is not in participants list
      mockFindOne.mockResolvedValueOnce({
        participants: ['user-99', 'user-88'],
      })

      const handler = socket._handlers['join_room']
      expect(handler).toBeDefined()
      await handler!({ matchRequestId: 'match-abc' })

      expect(socket.join).not.toHaveBeenCalled()
      const errorEvt = socket._emitted.find((e) => e.event === 'error')
      expect(errorEvt).toBeDefined()
      expect((errorEvt!.data as { message: string }).message).toBe('Not a participant')
    })

    it('rejects when Chat document not found', async () => {
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      mockFindOne.mockResolvedValueOnce(null)

      await socket._handlers['join_room']!({ matchRequestId: 'match-abc' })

      expect(socket.join).not.toHaveBeenCalled()
      expect(socket._emitted.find((e) => e.event === 'error')).toBeDefined()
    })

    it('joins room when user is a valid participant', async () => {
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      mockFindOne.mockResolvedValueOnce({
        participants: ['user-1', 'user-2'],
      })

      await socket._handlers['join_room']!({ matchRequestId: 'match-abc' })

      expect(socket.join).toHaveBeenCalledWith('match-abc')
      expect(socket._emitted.find((e) => e.event === 'error')).toBeUndefined()
    })

    it('joins room without DB check in mock mode', async () => {
      ;(env as { USE_MOCK_SERVICES: boolean }).USE_MOCK_SERVICES = true
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      await socket._handlers['join_room']!({ matchRequestId: 'match-mock' })

      expect(mockFindOne).not.toHaveBeenCalled()
      expect(socket.join).toHaveBeenCalledWith('match-mock')
    })
  })

  describe('send_message', () => {
    it('pushes message to Chat via findOneAndUpdate and emits message_received to room', async () => {
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      mockFindOneAndUpdate.mockResolvedValueOnce({})

      await socket._handlers['send_message']!({
        matchRequestId: 'match-abc',
        content: 'Hello!',
        type: 'TEXT',
      })

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { matchRequestId: 'match-abc', participants: 'user-1' },
        expect.objectContaining({
          $push: expect.objectContaining({ messages: expect.any(Object) }),
          $set: expect.objectContaining({ lastMessage: expect.any(Object) }),
        }),
      )

      const roomEmit = io._toEmitted.find((e) => e.event === 'message_received')
      expect(roomEmit).toBeDefined()
      expect(roomEmit!.room).toBe('match-abc')
      const msg = roomEmit!.data as { senderId: string; content: string; type: string }
      expect(msg.senderId).toBe('user-1')
      expect(msg.content).toBe('Hello!')
      expect(msg.type).toBe('TEXT')
    })

    it('skips DB call in mock mode but still emits message_received', async () => {
      ;(env as { USE_MOCK_SERVICES: boolean }).USE_MOCK_SERVICES = true
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      await socket._handlers['send_message']!({
        matchRequestId: 'match-mock',
        content: 'Mock msg',
        type: 'TEXT',
      })

      expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
      const roomEmit = io._toEmitted.find((e) => e.event === 'message_received')
      expect(roomEmit).toBeDefined()
    })
  })

  describe('mark_read', () => {
    it('emits message_read with correct messageIds and readBy', async () => {
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      mockUpdateOne.mockResolvedValueOnce({})

      await socket._handlers['mark_read']!({
        matchRequestId: 'match-abc',
        messageIds: ['msg-1', 'msg-2'],
      })

      const roomEmit = io._toEmitted.find((e) => e.event === 'message_read')
      expect(roomEmit).toBeDefined()
      expect(roomEmit!.room).toBe('match-abc')
      const payload = roomEmit!.data as { messageIds: string[]; readBy: string }
      expect(payload.messageIds).toEqual(['msg-1', 'msg-2'])
      expect(payload.readBy).toBe('user-1')
    })

    it('still emits message_read even in mock mode (no DB call)', async () => {
      ;(env as { USE_MOCK_SERVICES: boolean }).USE_MOCK_SERVICES = true
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      await socket._handlers['mark_read']!({
        matchRequestId: 'match-mock',
        messageIds: ['msg-x'],
      })

      expect(mockUpdateOne).not.toHaveBeenCalled()
      const roomEmit = io._toEmitted.find((e) => e.event === 'message_read')
      expect(roomEmit).toBeDefined()
    })
  })

  describe('typing', () => {
    it('emits user_typing via socket.to (not io.to — not back to sender)', () => {
      const socket = makeSocket('user-1')
      const io = makeIo()
      registerChatHandlers(io as never, socket as never)

      socket._handlers['typing']!({ matchRequestId: 'match-abc' })

      // Must be on socket._toEmitted (socket.to — broadcast), NOT io._toEmitted
      const broadcastEvt = socket._toEmitted.find((e) => e.event === 'user_typing')
      expect(broadcastEvt).toBeDefined()
      expect(broadcastEvt!.room).toBe('match-abc')
      expect((broadcastEvt!.data as { userId: string }).userId).toBe('user-1')

      // Must NOT have been sent via io.to (which goes back to sender too)
      const ioEvt = io._toEmitted.find((e) => e.event === 'user_typing')
      expect(ioEvt).toBeUndefined()
    })
  })
})
