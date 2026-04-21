/**
 * Video service unit tests — TDD.
 * All external calls mocked: DB, MongoDB Chat, dailyco, redis.
 * Runs with USE_MOCK_SERVICES=true.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks — all vi.fn() references used inside vi.mock factories
//    must be created with vi.hoisted so they are available before imports. ────

const {
  mockSelect,
  mockInsert,
  mockRedisGet,
  mockRedisSet,
  mockRedisScan,
  mockCreateRoom,
  mockDeleteRoom,
  mockChatFindOneAndUpdate,
} = vi.hoisted(() => ({
  mockSelect:              vi.fn(),
  mockInsert:              vi.fn(),
  mockRedisGet:            vi.fn(),
  mockRedisSet:            vi.fn(),
  mockRedisScan:           vi.fn(),
  mockCreateRoom:          vi.fn(),
  mockDeleteRoom:          vi.fn(),
  mockChatFindOneAndUpdate: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
}));

vi.mock('@smartshaadi/db', () => ({
  profiles:      {},
  matchRequests: {},
}));

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  or:  vi.fn((...args: unknown[]) => ({ type: 'or', args })),
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    USE_MOCK_SERVICES: true,
    REDIS_URL: 'redis://localhost:6379',
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get:  mockRedisGet,
    set:  mockRedisSet,
    scan: mockRedisScan,
  },
}));

vi.mock('../../lib/dailyco.js', () => ({
  createRoom: mockCreateRoom,
  deleteRoom:  mockDeleteRoom,
}));

vi.mock('../../infrastructure/mongo/models/Chat.js', () => ({
  Chat: {
    findOneAndUpdate: mockChatFindOneAndUpdate,
  },
}));

// ── DB chain helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeSelectChain(rows: Row[]) {
  return {
    from:  vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function makeSelectNoLimit(rows: Row[]) {
  return {
    from:  vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID    = 'user-uuid-1';
const OTHER_USER = 'user-uuid-2';
const PROFILE_ID = 'profile-uuid-1';
const OTHER_PROF = 'profile-uuid-2';
const MATCH_ID   = '11111111-1111-1111-1111-111111111111';
const MEETING_ID = '22222222-2222-2222-2222-222222222222';

const profileRow    = { id: PROFILE_ID };
const otherProfRow  = { id: OTHER_PROF };
const matchRow      = { id: MATCH_ID, senderId: PROFILE_ID, receiverId: OTHER_PROF, status: 'ACCEPTED' };
const mockDailyRoom = {
  id:        'mock_123',
  name:      'mock-room-match-' + MATCH_ID,
  url:       'https://smartshaadi.daily.co/mock-room-match-' + MATCH_ID,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};

// ── Import service under test (after mocks) ───────────────────────────────────

import {
  createVideoRoom,
  endVideoRoom,
  scheduleMeeting,
  respondMeeting,
  getMeetings,
} from '../service.js';

// ── createVideoRoom ───────────────────────────────────────────────────────────

describe('createVideoRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects non-participant with FORBIDDEN', async () => {
    // Profile lookup returns profileRow, but matchRequests returns nothing
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))   // resolve userId → profileId
      .mockReturnValueOnce(makeSelectNoLimit([]));            // no accepted match found

    await expect(
      createVideoRoom(USER_ID, { matchId: MATCH_ID, durationMin: 60 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('participant gets VideoRoom with roomUrl containing "mock-room"', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))  // resolve profileId
      .mockReturnValueOnce(makeSelectNoLimit([matchRow])); // accepted match found
    mockCreateRoom.mockResolvedValue(mockDailyRoom);
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    const result = await createVideoRoom(USER_ID, { matchId: MATCH_ID, durationMin: 60 });

    expect(result.roomUrl).toContain('mock-room');
    expect(result.matchId).toBe(MATCH_ID);
    expect(result.token).toBe('');
    expect(result.roomId).toBeDefined();
  });

  it('appends SYSTEM message to Chat on room creation', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockCreateRoom.mockResolvedValue(mockDailyRoom);
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    await createVideoRoom(USER_ID, { matchId: MATCH_ID, durationMin: 60 });

    expect(mockChatFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = mockChatFindOneAndUpdate.mock.calls[0] as [unknown, { $push: { messages: { type: string; content: string } } }];
    expect((filter as { matchRequestId: string }).matchRequestId).toBe(MATCH_ID);
    expect(update.$push.messages.type).toBe('SYSTEM');
    expect(update.$push.messages.content).toContain('Video call started');
  });
});

// ── endVideoRoom ──────────────────────────────────────────────────────────────

describe('endVideoRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls deleteRoom and appends SYSTEM message', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockDeleteRoom.mockResolvedValue(undefined);
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    const result = await endVideoRoom(USER_ID, mockDailyRoom.name, MATCH_ID);

    expect(result.success).toBe(true);
    expect(mockDeleteRoom).toHaveBeenCalledWith(mockDailyRoom.name);
    expect(mockChatFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [, update] = mockChatFindOneAndUpdate.mock.calls[0] as [unknown, { $push: { messages: { content: string } } }];
    expect(update.$push.messages.content).toContain('Video call ended');
  });
});

// ── scheduleMeeting ───────────────────────────────────────────────────────────

describe('scheduleMeeting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('stores meeting in Redis with TTL 604800 and correct key', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisSet.mockResolvedValue('OK');

    const scheduledAt = new Date(Date.now() + 86400000).toISOString();
    const result = await scheduleMeeting(USER_ID, {
      matchId: MATCH_ID,
      scheduledAt,
      durationMin: 30,
    });

    expect(result.status).toBe('PROPOSED');
    expect(result.matchId).toBe(MATCH_ID);
    expect(result.proposedBy).toBe(PROFILE_ID);

    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    const [key, , , ttl] = mockRedisSet.mock.calls[0] as [string, string, string, number];
    expect(key).toMatch(new RegExp(`^meeting:${MATCH_ID}:`));
    expect(ttl).toBe(604800);
  });
});

// ── respondMeeting ────────────────────────────────────────────────────────────

describe('respondMeeting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const storedMeeting = {
    id:          MEETING_ID,
    matchId:     MATCH_ID,
    proposedBy:  PROFILE_ID,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 30,
    roomUrl:     null,
    status:      'PROPOSED' as const,
    notes:       null,
  };

  it('rejects proposer from responding to own meeting with FORBIDDEN', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))  // resolve proposer profileId
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));  // match check
    mockRedisGet.mockResolvedValue(JSON.stringify(storedMeeting));

    // proposer (PROFILE_ID) tries to respond — should be forbidden
    await expect(
      respondMeeting(USER_ID, MATCH_ID, MEETING_ID, { status: 'CONFIRMED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('other participant can CONFIRM meeting and updates status', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([otherProfRow]))  // resolve other user's profileId
      .mockReturnValueOnce(makeSelectNoLimit([{ ...matchRow, senderId: PROFILE_ID, receiverId: OTHER_PROF }]));
    mockRedisGet.mockResolvedValue(JSON.stringify(storedMeeting));
    mockRedisSet.mockResolvedValue('OK');

    const result = await respondMeeting(OTHER_USER, MATCH_ID, MEETING_ID, { status: 'CONFIRMED' });

    expect(result.status).toBe('CONFIRMED');
    expect(mockRedisSet).toHaveBeenCalledTimes(1);
  });
});

// ── getMeetings ───────────────────────────────────────────────────────────────

describe('getMeetings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns meetings array sorted by scheduledAt ascending', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));

    const future1 = new Date(Date.now() + 172800000).toISOString(); // +2 days
    const future2 = new Date(Date.now() + 86400000).toISOString();  // +1 day (earlier)
    const meeting1 = { id: 'meet-1', matchId: MATCH_ID, proposedBy: PROFILE_ID, scheduledAt: future1, durationMin: 60, roomUrl: null, status: 'PROPOSED', notes: null };
    const meeting2 = { id: 'meet-2', matchId: MATCH_ID, proposedBy: OTHER_PROF, scheduledAt: future2, durationMin: 30, roomUrl: null, status: 'PROPOSED', notes: null };

    // Mock SCAN: returns cursor=0 and two keys
    mockRedisScan.mockResolvedValue(['0', [`meeting:${MATCH_ID}:meet-1`, `meeting:${MATCH_ID}:meet-2`]]);
    mockRedisGet
      .mockResolvedValueOnce(JSON.stringify(meeting1))
      .mockResolvedValueOnce(JSON.stringify(meeting2));

    const results = await getMeetings(USER_ID, MATCH_ID);

    expect(results).toHaveLength(2);
    // Earlier scheduledAt should come first
    expect(results[0]!.id).toBe('meet-2');
    expect(results[1]!.id).toBe('meet-1');
  });
});
