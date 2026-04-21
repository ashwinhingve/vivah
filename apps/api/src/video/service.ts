/**
 * Video service — Daily.co room creation + meeting scheduling via Redis.
 *
 * Rule 12: always resolve userId → profileId before touching matchRequests
 * (which references profiles.id, not users.id).
 */

import { db }              from '../lib/db.js';
import { redis }           from '../lib/redis.js';
import { createRoom, deleteRoom } from '../lib/dailyco.js';
import { Chat }            from '../infrastructure/mongo/models/Chat.js';
import { getIO }           from '../chat/socket/index.js';
import { queueNotification } from '../infrastructure/redis/queues.js';
import { profiles, matchRequests } from '@smartshaadi/db';
import { eq, or, and }     from 'drizzle-orm';
import type { VideoRoom, MeetingSchedule } from '@smartshaadi/types';
import type {
  CreateVideoRoomInput,
  ScheduleMeetingInput,
  RespondMeetingInput,
} from '@smartshaadi/schemas';

// ── Typed service error ───────────────────────────────────────────────────────

interface ServiceError extends Error {
  code: string;
  status: number;
}

function makeError(code: string, message: string, status: number): ServiceError {
  const e = new Error(message) as ServiceError;
  e.code   = code;
  e.status = status;
  return e;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve Better Auth userId → profiles.id (throws 403 if profile missing). */
async function resolveProfileId(userId: string): Promise<string> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) throw makeError('FORBIDDEN', 'Profile not found', 403);
  return row.id;
}

/** Resolve the OTHER participant's Better Auth userId for a match. Best-effort. */
async function resolveOtherUserId(myProfileId: string, matchId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ senderId: matchRequests.senderId, receiverId: matchRequests.receiverId })
      .from(matchRequests)
      .where(eq(matchRequests.id, matchId))
      .limit(1);
    const match = rows[0];
    if (!match) return null;
    const otherProfileId = match.senderId === myProfileId ? match.receiverId : match.senderId;
    return await resolveUserIdFromProfileId(otherProfileId);
  } catch {
    return null;
  }
}

/** Resolve profiles.id → users.id (Better Auth). Best-effort. */
async function resolveUserIdFromProfileId(profileId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    return rows[0]?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Assert that profileId is a participant (sender OR receiver) in an ACCEPTED match.
 * Returns the match row.
 */
async function assertParticipant(
  profileId: string,
  matchId: string,
): Promise<{ id: string; senderId: string; receiverId: string }> {
  const rows = await db
    .select({ id: matchRequests.id, senderId: matchRequests.senderId, receiverId: matchRequests.receiverId })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.id, matchId),
        eq(matchRequests.status, 'ACCEPTED'),
        or(
          eq(matchRequests.senderId, profileId),
          eq(matchRequests.receiverId, profileId),
        ),
      ),
    );
  const match = rows[0];
  if (!match) throw makeError('FORBIDDEN', 'Not a participant in this match', 403);
  return match;
}

/** Append a SYSTEM message to the MongoDB Chat for a match.
 *
 * Rule 11 compliance: in mock mode the Chat model is not connected.
 * We still invoke findOneAndUpdate so unit tests (which fully mock the Chat
 * module) can assert the call. The try/catch prevents a 10s Mongoose buffer
 * hang from crashing the process when running without a real MongoDB URI.
 */
async function appendSystemMessage(matchId: string, content: string): Promise<void> {
  try {
    await Chat.findOneAndUpdate(
      { matchRequestId: matchId },
      {
        $push: {
          messages: {
            senderId: 'SYSTEM',
            content,
            type: 'SYSTEM',
            sentAt: new Date(),
          },
        },
        $set: {
          lastMessage: { content, sentAt: new Date(), senderId: 'SYSTEM' },
        },
      },
      { upsert: false },
    );
  } catch {
    // Non-fatal — SYSTEM message append failure must not block the video call flow.
    // In mock mode (USE_MOCK_SERVICES=true) Mongoose is not connected; this is expected.
  }
}

// ── createVideoRoom ───────────────────────────────────────────────────────────

export async function createVideoRoom(
  userId: string,
  input: CreateVideoRoomInput,
): Promise<VideoRoom> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, input.matchId);

  const room = await createRoom(`match-${input.matchId}`, input.durationMin);

  // Append SYSTEM message (no-op in mock mode)
  await appendSystemMessage(
    input.matchId,
    `Video call started — join: ${room.url}`,
  );

  const io = getIO();
  if (io) {
    io.of('/chat').to(input.matchId).emit('video_call_started', {
      matchId: input.matchId,
      roomUrl: room.url,
    });
  }

  return {
    roomId:    room.id,
    roomName:  room.name,
    roomUrl:   room.url,
    token:     '',
    expiresAt: room.expiresAt,
    matchId:   input.matchId,
  };
}

// ── endVideoRoom ──────────────────────────────────────────────────────────────

export async function endVideoRoom(
  userId: string,
  roomName: string,
  matchId: string,
): Promise<{ success: true }> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  await deleteRoom(roomName);
  await appendSystemMessage(matchId, 'Video call ended');

  return { success: true };
}

// ── scheduleMeeting ───────────────────────────────────────────────────────────

const MEETING_TTL = 604800; // 7 days in seconds

export async function scheduleMeeting(
  userId: string,
  input: ScheduleMeetingInput,
): Promise<MeetingSchedule> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, input.matchId);

  const meetingId = crypto.randomUUID();
  const meeting: MeetingSchedule = {
    id:          meetingId,
    matchId:     input.matchId,
    proposedBy:  profileId,
    scheduledAt: input.scheduledAt,
    durationMin: input.durationMin,
    roomUrl:     null,
    status:      'PROPOSED',
    notes:       input.notes ?? null,
  };

  await redis.set(
    `meeting:${input.matchId}:${meetingId}`,
    JSON.stringify(meeting),
    'EX',
    MEETING_TTL,
  );

  const otherUserId = await resolveOtherUserId(profileId, input.matchId);
  if (otherUserId) {
    await queueNotification({
      userId:  otherUserId,
      type:    'MEETING_PROPOSED',
      payload: {
        matchId:     input.matchId,
        meetingId,
        scheduledAt: input.scheduledAt,
        durationMin: input.durationMin,
      },
    }).catch(() => {
      // Non-fatal — scheduling succeeds even if notification enqueue fails.
    });
  }

  return meeting;
}

// ── respondMeeting ────────────────────────────────────────────────────────────

export async function respondMeeting(
  userId: string,
  matchId: string,
  meetingId: string,
  input: RespondMeetingInput,
): Promise<MeetingSchedule> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  const raw = await redis.get(`meeting:${matchId}:${meetingId}`);
  if (!raw) throw makeError('NOT_FOUND', 'Meeting not found', 404);

  const meeting = JSON.parse(raw) as MeetingSchedule;

  // Only the OTHER participant (not the proposer) can respond
  if (meeting.proposedBy === profileId) {
    throw makeError('FORBIDDEN', 'Proposer cannot respond to their own meeting', 403);
  }

  const updated: MeetingSchedule = {
    ...meeting,
    status: input.status,
    notes:  input.notes ?? meeting.notes,
  };

  await redis.set(
    `meeting:${matchId}:${meetingId}`,
    JSON.stringify(updated),
    'EX',
    MEETING_TTL,
  );

  if (input.status === 'CONFIRMED') {
    const proposerUserId = await resolveUserIdFromProfileId(meeting.proposedBy);
    if (proposerUserId) {
      await queueNotification({
        userId:  proposerUserId,
        type:    'MEETING_CONFIRMED',
        payload: { matchId, meetingId, scheduledAt: meeting.scheduledAt },
      }).catch(() => { /* non-fatal */ });
    }
  }

  return updated;
}

// ── getMeetings ───────────────────────────────────────────────────────────────

export async function getMeetings(
  userId: string,
  matchId: string,
): Promise<MeetingSchedule[]> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  // SCAN for all meeting keys under this matchId
  const [, keys] = await redis.scan(0, 'MATCH', `meeting:${matchId}:*`, 'COUNT', 100) as [string, string[]];

  if (!keys || keys.length === 0) return [];

  const meetings: MeetingSchedule[] = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) {
      meetings.push(JSON.parse(raw) as MeetingSchedule);
    }
  }

  // Sort ascending by scheduledAt
  meetings.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return meetings;
}
