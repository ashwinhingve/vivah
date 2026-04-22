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
  mockRedisDel,
  mockRedisScan,
  mockCreateRoom,
  mockDeleteRoom,
  mockChatFindOneAndUpdate,
} = vi.hoisted(() => ({
  mockSelect:              vi.fn(),
  mockInsert:              vi.fn(),
  mockRedisGet:            vi.fn(),
  mockRedisSet:            vi.fn(),
  mockRedisDel:            vi.fn(),
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
    del:  mockRedisDel,
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

vi.mock('../../chat/socket/index.js', () => ({
  getIO: vi.fn(() => null),
}));

vi.mock('../../infrastructure/redis/queues.js', () => ({
  queueNotification: vi.fn().mockResolvedValue(undefined),
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
const OTHER_MATCH = '33333333-3333-3333-3333-333333333333';
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
  getActiveRoom,
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
    mockRedisGet.mockResolvedValue(null); // no existing room in Redis
    mockCreateRoom.mockResolvedValue(mockDailyRoom);
    mockRedisSet.mockResolvedValue('OK');
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
    mockRedisGet.mockResolvedValue(null);
    mockCreateRoom.mockResolvedValue(mockDailyRoom);
    mockRedisSet.mockResolvedValue('OK');
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    await createVideoRoom(USER_ID, { matchId: MATCH_ID, durationMin: 60 });

    expect(mockChatFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = mockChatFindOneAndUpdate.mock.calls[0] as [unknown, { $push: { messages: { type: string; content: string } } }];
    expect((filter as { matchRequestId: string }).matchRequestId).toBe(MATCH_ID);
    expect(update.$push.messages.type).toBe('SYSTEM');
    expect(update.$push.messages.content).toContain('Video call started');
  });

  // FIX 1: Redis room deduplication tests
  it('returns 409 ROOM_EXISTS if room already exists for match', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    // Redis already has a room for this matchId
    mockRedisGet.mockResolvedValue('match-' + MATCH_ID);

    await expect(
      createVideoRoom(USER_ID, { matchId: MATCH_ID, durationMin: 60 }),
    ).rejects.toMatchObject({ code: 'ROOM_EXISTS' });
  });

  it('stores room name in Redis on creation', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisGet.mockResolvedValue(null);
    mockCreateRoom.mockResolvedValue(mockDailyRoom);
    mockRedisSet.mockResolvedValue('OK');
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    await createVideoRoom(USER_ID, { matchId: MATCH_ID, durationMin: 60 });

    // Should have set room:active:{matchId} with the room name
    const setCall = mockRedisSet.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('room:active:'),
    );
    expect(setCall).toBeDefined();
    expect(setCall![0]).toBe(`room:active:${MATCH_ID}`);
    expect(setCall![1]).toBe(mockDailyRoom.name);
    expect(setCall![2]).toBe('EX');
    expect(typeof setCall![3]).toBe('number');
  });
});

// ── getActiveRoom ─────────────────────────────────────────────────────────────

describe('getActiveRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns existing room URL from Redis on GET', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    // Redis has an active room
    mockRedisGet.mockResolvedValue('match-' + MATCH_ID);

    const result = await getActiveRoom(USER_ID, MATCH_ID);

    expect(result).not.toBeNull();
    expect(result!.roomName).toBe('match-' + MATCH_ID);
    expect(result!.matchId).toBe(MATCH_ID);
  });

  it('returns null when no active room in Redis', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisGet.mockResolvedValue(null);

    const result = await getActiveRoom(USER_ID, MATCH_ID);

    expect(result).toBeNull();
  });
});

// ── endVideoRoom ──────────────────────────────────────────────────────────────

describe('endVideoRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls deleteRoom and appends SYSTEM message', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    // Redis lookup returns room name
    mockRedisGet.mockResolvedValue(mockDailyRoom.name);
    mockDeleteRoom.mockResolvedValue(undefined);
    mockRedisDel.mockResolvedValue(1);
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    const result = await endVideoRoom(USER_ID, mockDailyRoom.name, MATCH_ID);

    expect(result.success).toBe(true);
    expect(mockDeleteRoom).toHaveBeenCalledWith(mockDailyRoom.name);
    expect(mockChatFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [, update] = mockChatFindOneAndUpdate.mock.calls[0] as [unknown, { $push: { messages: { content: string } } }];
    expect(update.$push.messages.content).toContain('Video call ended');
  });

  // FIX 1: endVideoRoom uses Redis lookup, not client-sent roomName
  it('uses Redis lookup not client roomName for deletion', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    const redisRoomName = 'match-' + MATCH_ID + '-real';
    const clientRoomName = 'some-attacker-supplied-name';
    mockRedisGet.mockResolvedValue(redisRoomName);
    mockDeleteRoom.mockResolvedValue(undefined);
    mockRedisDel.mockResolvedValue(1);
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    await endVideoRoom(USER_ID, clientRoomName, MATCH_ID);

    // Must delete using the Redis-stored name, not the client-supplied name
    expect(mockDeleteRoom).toHaveBeenCalledWith(redisRoomName);
  });

  it('deletes Redis key on room end', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisGet.mockResolvedValue(mockDailyRoom.name);
    mockDeleteRoom.mockResolvedValue(undefined);
    mockRedisDel.mockResolvedValue(1);
    mockChatFindOneAndUpdate.mockResolvedValue(null);

    await endVideoRoom(USER_ID, mockDailyRoom.name, MATCH_ID);

    expect(mockRedisDel).toHaveBeenCalledWith(`room:active:${MATCH_ID}`);
  });
});

// ── scheduleMeeting ───────────────────────────────────────────────────────────

describe('scheduleMeeting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('stores meeting in Redis with calculated TTL and correct key', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisSet.mockResolvedValue('OK');

    // Schedule 1 day from now
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
    // FIX 4: TTL must NOT be fixed 604800 — should be dynamic based on scheduledAt
    // For 1-day-from-now: TTL = ~86400 + 86400 (24h buffer) ≈ 172800
    // Must be between 86400 (min) and 2678400 (max 31 days)
    expect(ttl).toBeGreaterThanOrEqual(86400);
    expect(ttl).toBeLessThanOrEqual(2678400);
    // Specifically, for 1-day meeting, TTL should be around 2 days (~172800)
    expect(ttl).toBeGreaterThan(100000); // more than 1 day
    expect(ttl).toBeLessThan(300000);    // less than 3.5 days
  });

  it('uses minimum TTL of 24h for meetings scheduled very soon', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisSet.mockResolvedValue('OK');

    // Schedule just 10 minutes from now (scheduledAt - now + 24h = ~25h → TTL = 25h? but min is 86400)
    const scheduledAt = new Date(Date.now() + 600000).toISOString(); // +10 min
    await scheduleMeeting(USER_ID, {
      matchId: MATCH_ID,
      scheduledAt,
      durationMin: 30,
    });

    const [, , , ttl] = mockRedisSet.mock.calls[0] as [string, string, string, number];
    expect(ttl).toBeGreaterThanOrEqual(86400); // min 24h
  });

  it('caps TTL at 31 days for far-future meetings', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisSet.mockResolvedValue('OK');

    // Schedule 35 days from now (beyond 31-day max)
    const scheduledAt = new Date(Date.now() + 35 * 86400000).toISOString();
    await scheduleMeeting(USER_ID, {
      matchId: MATCH_ID,
      scheduledAt,
      durationMin: 30,
    });

    const [, , , ttl] = mockRedisSet.mock.calls[0] as [string, string, string, number];
    expect(ttl).toBeLessThanOrEqual(2678400); // max 31 days
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

  // FIX 3: Status guard tests
  it('rejects respond on already-CANCELLED meeting', async () => {
    const cancelledMeeting = { ...storedMeeting, status: 'CANCELLED' as const };
    mockSelect
      .mockReturnValueOnce(makeSelectChain([otherProfRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisGet.mockResolvedValue(JSON.stringify(cancelledMeeting));

    await expect(
      respondMeeting(OTHER_USER, MATCH_ID, MEETING_ID, { status: 'CONFIRMED' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('only PROPOSED meetings can be responded to', async () => {
    const confirmedMeeting = { ...storedMeeting, status: 'CONFIRMED' as const };
    mockSelect
      .mockReturnValueOnce(makeSelectChain([otherProfRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));
    mockRedisGet.mockResolvedValue(JSON.stringify(confirmedMeeting));

    await expect(
      respondMeeting(OTHER_USER, MATCH_ID, MEETING_ID, { status: 'CANCELLED' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('rejects respond with mismatched matchId', async () => {
    // Meeting was stored under MATCH_ID, but request uses OTHER_MATCH (attacker's URL).
    mockSelect
      .mockReturnValueOnce(makeSelectChain([otherProfRow]))
      .mockReturnValueOnce(makeSelectNoLimit([
        { id: OTHER_MATCH, senderId: PROFILE_ID, receiverId: OTHER_PROF, status: 'ACCEPTED' },
      ]));
    // Redis returns meeting where matchId = MATCH_ID (the real one)
    // but URL matchId = OTHER_MATCH (mismatch!)
    mockRedisGet.mockResolvedValue(JSON.stringify({ ...storedMeeting, matchId: MATCH_ID }));

    await expect(
      respondMeeting(OTHER_USER, OTHER_MATCH, MEETING_ID, { status: 'CONFIRMED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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

    // Mock SCAN: returns cursor=0 and two keys (single page)
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

  // FIX 2: SCAN cursor loop test
  it('returns all meetings when >100 exist — SCAN cursor loop', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([profileRow]))
      .mockReturnValueOnce(makeSelectNoLimit([matchRow]));

    // Build 110 meetings
    const meetingCount = 110;
    const meetings = Array.from({ length: meetingCount }, (_, i) => ({
      id: `meet-${i}`,
      matchId: MATCH_ID,
      proposedBy: PROFILE_ID,
      scheduledAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      durationMin: 30,
      roomUrl: null,
      status: 'PROPOSED',
      notes: null,
    }));

    // First scan page: cursor='cursor-page-2', returns first 100 keys
    const page1Keys = meetings.slice(0, 100).map(m => `meeting:${MATCH_ID}:${m.id}`);
    // Second scan page: cursor='0', returns remaining 10 keys
    const page2Keys = meetings.slice(100).map(m => `meeting:${MATCH_ID}:${m.id}`);

    mockRedisScan
      .mockResolvedValueOnce(['cursor-page-2', page1Keys])  // first page, non-zero cursor
      .mockResolvedValueOnce(['0', page2Keys]);               // second page, cursor=0 → done

    // Redis.get returns each meeting's JSON in order
    meetings.forEach(m => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(m));
    });

    const results = await getMeetings(USER_ID, MATCH_ID);

    // Must have fetched both pages = 110 meetings total
    expect(results).toHaveLength(110);
    // SCAN must have been called twice (cursor loop)
    expect(mockRedisScan).toHaveBeenCalledTimes(2);
  });
});
