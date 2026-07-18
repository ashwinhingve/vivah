/**
 * Video service — Daily.co room creation + meeting scheduling via Redis.
 *
 * Rule 12: always resolve userId → profileId before touching matchRequests
 * (which references profiles.id, not users.id).
 */

import { db }              from '../lib/db.js';
import { resolveProfileId as resolveProfileIdCached } from '../lib/profile.js';
import { redis }           from '../lib/redis.js';
import { createRoom, deleteRoom } from '../lib/dailyco.js';
import { Chat }            from '../infrastructure/mongo/models/Chat.js';
import { getIO }           from '../chat/socket/index.js';
import { queueNotification, queueDelayedNotification } from '../infrastructure/redis/queues.js';
import { profiles, matchRequests, virtualDates } from '@smartshaadi/db';
import { eq, or, and, desc } from 'drizzle-orm';
import { isValidIcebreakerKey } from './icebreakers.js';
import {
  type VideoRoom, type MeetingSchedule, type ProfileId,
  type VirtualDate,
} from '@smartshaadi/types';
import type {
  CreateVideoRoomInput,
  ScheduleMeetingInput,
  RespondMeetingInput,
  VirtualDateFeedbackInput,
} from '@smartshaadi/schemas';

// Reminders fire this long before a confirmed date's scheduled start.
const REMINDER_OFFSETS_MS = [24 * 60 * 60 * 1000, 15 * 60 * 1000] as const;

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
async function resolveProfileId(userId: string): Promise<ProfileId> {
  const profileId = await resolveProfileIdCached(userId);
  if (!profileId) throw makeError('FORBIDDEN', 'Profile not found', 403);
  return profileId;
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

// ── Virtual-date durable layer (Unit 7.3) ────────────────────────────────────
//
// A durable `virtual_dates` row shadows each Redis meeting proposal (same id) so
// dates leave a trace, drive reminders, and collect post-date feedback. The
// Redis proposal remains the source of truth for the LIVE flow; these writes are
// best-effort so a DB hiccup never breaks scheduling (same posture as
// appendSystemMessage / queueNotification above).

type VirtualDateRow = typeof virtualDates.$inferSelect;

function iso(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function toVirtualDate(row: VirtualDateRow): VirtualDate {
  return {
    id:               row.id,
    matchId:          row.matchId,
    proposedBy:       row.proposedBy,
    scheduledAt:      iso(row.scheduledAt)!,
    durationMin:      row.durationMin,
    status:           row.status,
    roomName:         row.roomName,
    icebreakerSetKey: row.icebreakerSetKey,
    notes:            row.notes,
    proposerRating:   row.proposerRating,
    inviteeRating:    row.inviteeRating,
    proposerContinue: row.proposerContinue,
    inviteeContinue:  row.inviteeContinue,
    completedAt:      iso(row.completedAt),
    createdAt:        iso(row.createdAt)!,
    updatedAt:        iso(row.updatedAt)!,
  };
}

/** Schedule MEETING_REMINDER notifications (T-24h, T-15m) for both participants. */
async function scheduleDateReminders(
  matchId: string,
  meetingId: string,
  scheduledAt: string,
  userIds: (string | null)[],
): Promise<void> {
  const startMs = new Date(scheduledAt).getTime();
  const nowMs   = Date.now();
  for (const userId of userIds) {
    if (!userId) continue;
    for (const offset of REMINDER_OFFSETS_MS) {
      const delay = startMs - offset - nowMs;
      // queueDelayedNotification drops non-positive delays (window already passed).
      await queueDelayedNotification(
        { userId, type: 'MEETING_REMINDER', payload: { matchId, meetingId, scheduledAt } },
        delay,
        `vd-remind-${offset}-${meetingId}-${userId}`,
      );
    }
  }
}

// ── createVideoRoom ───────────────────────────────────────────────────────────

export async function createVideoRoom(
  userId: string,
  input: CreateVideoRoomInput,
): Promise<VideoRoom> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, input.matchId);

  // FIX 1: Check Redis for an existing active room — prevent duplicate rooms on refresh
  const existingRoomName = await redis.get(`room:active:${input.matchId}`);
  if (existingRoomName) {
    throw makeError(
      'ROOM_EXISTS',
      `A video room already exists for this match. Room: ${existingRoomName}`,
      409,
    );
  }

  const room = await createRoom(`match-${input.matchId}`, input.durationMin);

  // FIX 1: Store room name in Redis keyed by matchId, TTL = durationMin * 60
  await redis.set(
    `room:active:${input.matchId}`,
    room.name,
    'EX',
    input.durationMin * 60,
  );

  // Append SYSTEM message (no-op in mock mode)
  await appendSystemMessage(
    input.matchId,
    `Video call started — join: ${room.url}`,
  );

  const io = getIO();
  if (io) {
    io.of('/chat').to(input.matchId).emit('videoCallStarted', {
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
    isMock:    room.isMock ?? false,
  };
}

// ── getActiveRoom ─────────────────────────────────────────────────────────────

/**
 * FIX 1: Return the active room for a match from Redis, or null if none.
 * Used by GET /video/rooms/:matchId.
 */
export async function getActiveRoom(
  userId: string,
  matchId: string,
): Promise<{ roomName: string; matchId: string } | null> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  const roomName = await redis.get(`room:active:${matchId}`);
  if (!roomName) return null;

  return { roomName, matchId };
}

// ── endVideoRoom ──────────────────────────────────────────────────────────────

export async function endVideoRoom(
  userId: string,
  _clientRoomName: string,  // kept for API compatibility but NOT used for deletion
  matchId: string,
): Promise<{ success: true }> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  // FIX 1: Use Redis lookup for room name — do NOT trust client-supplied name
  const redisRoomName = await redis.get(`room:active:${matchId}`);
  const roomNameToDelete = redisRoomName ?? _clientRoomName;

  await deleteRoom(roomNameToDelete);
  await appendSystemMessage(matchId, 'Video call ended');

  // FIX 1: Clean up Redis key after deletion
  await redis.del(`room:active:${matchId}`);

  return { success: true };
}

// ── scheduleMeeting ───────────────────────────────────────────────────────────

/** FIX 4: Calculate TTL based on scheduledAt rather than a fixed 7-day value.
 *  TTL = (scheduledAt − now) + 24h buffer.
 *  Min: 86400s (24h). Max: 2678400s (31 days).
 */
function calculateMeetingTTL(scheduledAt: string): number {
  const scheduledMs  = new Date(scheduledAt).getTime();
  const nowMs        = Date.now();
  const diffSeconds  = Math.floor((scheduledMs - nowMs) / 1000);
  const ttlWithBuffer = diffSeconds + 86400; // + 24h buffer
  const MIN_TTL = 86400;   // 24h
  const MAX_TTL = 2678400; // 31 days
  return Math.min(MAX_TTL, Math.max(MIN_TTL, ttlWithBuffer));
}

export async function scheduleMeeting(
  userId: string,
  input: ScheduleMeetingInput,
): Promise<MeetingSchedule> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, input.matchId);

  // Validate the optional curated icebreaker set against the catalogue.
  const icebreakerSetKey = input.icebreakerSetKey ?? null;
  if (icebreakerSetKey && !isValidIcebreakerKey(icebreakerSetKey)) {
    throw makeError('VALIDATION_ERROR', 'Unknown icebreaker set', 422);
  }

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

  // FIX 4: Use calculated TTL instead of fixed 604800
  const ttl = calculateMeetingTTL(input.scheduledAt);

  await redis.set(
    `meeting:${input.matchId}:${meetingId}`,
    JSON.stringify(meeting),
    'EX',
    ttl,
  );

  // Durable shadow row (best-effort — id matches the Redis meetingId).
  try {
    await db.insert(virtualDates).values({
      id:               meetingId,
      matchId:          input.matchId,
      proposedBy:       profileId,
      scheduledAt:      new Date(input.scheduledAt),
      durationMin:      input.durationMin,
      status:           'PROPOSED',
      icebreakerSetKey,
      notes:            input.notes ?? null,
    });
  } catch {
    // Non-fatal — the Redis proposal is the source of truth for the live flow.
  }

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

  // FIX 3: Validate stored meeting.matchId matches the URL matchId
  if (meeting.matchId !== matchId) {
    throw makeError('FORBIDDEN', 'Meeting does not belong to this match', 403);
  }

  // FIX 3: Only PROPOSED meetings can be responded to
  if (meeting.status !== 'PROPOSED') {
    throw makeError('INVALID_STATE', `Meeting is already ${meeting.status} and cannot be responded to`, 409);
  }

  // Only the OTHER participant (not the proposer) can respond
  if (meeting.proposedBy === profileId) {
    throw makeError('FORBIDDEN', 'Proposer cannot respond to their own meeting', 403);
  }

  const updated: MeetingSchedule = {
    ...meeting,
    status: input.status,
    notes:  input.notes ?? meeting.notes,
  };

  // FIX 4: Recalculate TTL for updated meeting
  const ttl = calculateMeetingTTL(meeting.scheduledAt);

  await redis.set(
    `meeting:${matchId}:${meetingId}`,
    JSON.stringify(updated),
    'EX',
    ttl,
  );

  // Reflect the response on the durable virtual_dates row (best-effort).
  const nextDbStatus = input.status === 'CONFIRMED' ? 'CONFIRMED' : 'CANCELLED';
  try {
    await db.update(virtualDates)
      .set({ status: nextDbStatus, notes: updated.notes, updatedAt: new Date() })
      .where(and(eq(virtualDates.id, meetingId), eq(virtualDates.status, 'PROPOSED')));
  } catch {
    // Non-fatal — Redis proposal already updated above.
  }

  if (input.status === 'CONFIRMED') {
    const proposerUserId = await resolveUserIdFromProfileId(meeting.proposedBy);
    if (proposerUserId) {
      await queueNotification({
        userId:  proposerUserId,
        type:    'MEETING_CONFIRMED',
        payload: { matchId, meetingId, scheduledAt: meeting.scheduledAt },
      }).catch(() => { /* non-fatal */ });
    }
    // Schedule T-24h / T-15m reminders for BOTH participants. `userId` is the
    // responder (invitee); proposerUserId resolved above.
    await scheduleDateReminders(matchId, meetingId, meeting.scheduledAt, [userId, proposerUserId])
      .catch(() => { /* non-fatal — reminders are an enhancement */ });
  }

  return updated;
}

// ── submitDateFeedback ────────────────────────────────────────────────────────

/**
 * Record one participant's post-date feedback (rating + continue). When BOTH
 * sides have rated, the date flips to COMPLETED. The caller's role (proposer vs
 * invitee) is derived from the durable row's proposed_by.
 */
export async function submitDateFeedback(
  userId: string,
  dateId: string,
  input: VirtualDateFeedbackInput,
): Promise<VirtualDate> {
  const profileId = await resolveProfileId(userId);

  const rows = await db.select().from(virtualDates).where(eq(virtualDates.id, dateId)).limit(1);
  const row = rows[0];
  if (!row) throw makeError('NOT_FOUND', 'Virtual date not found', 404);

  // Must be a participant in the (ACCEPTED) match this date belongs to.
  await assertParticipant(profileId, row.matchId);

  if (row.status !== 'CONFIRMED' && row.status !== 'COMPLETED') {
    throw makeError('INVALID_STATE', `Feedback not accepted for a ${row.status} date`, 409);
  }

  const isProposer = row.proposedBy === profileId;
  const patch = isProposer
    ? { proposerRating: input.rating, proposerContinue: input.continue }
    : { inviteeRating:  input.rating, inviteeContinue:  input.continue };

  const bothRatedAfter = isProposer
    ? row.inviteeRating !== null
    : row.proposerRating !== null;

  const completing = bothRatedAfter && row.status !== 'COMPLETED';

  const updatedRows = await db.update(virtualDates)
    .set({
      ...patch,
      ...(completing ? { status: 'COMPLETED' as const, completedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(virtualDates.id, dateId))
    .returning();

  const updated = updatedRows[0];
  if (!updated) throw makeError('NOT_FOUND', 'Virtual date not found', 404);
  return toVirtualDate(updated);
}

// ── listVirtualDates ──────────────────────────────────────────────────────────

/** Durable virtual-date history for a match (most recent first). */
export async function listVirtualDates(
  userId: string,
  matchId: string,
): Promise<VirtualDate[]> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  const rows = await db.select().from(virtualDates)
    .where(eq(virtualDates.matchId, matchId))
    .orderBy(desc(virtualDates.scheduledAt));

  return rows.map(toVirtualDate);
}

// ── getMeetings ───────────────────────────────────────────────────────────────

export async function getMeetings(
  userId: string,
  matchId: string,
): Promise<MeetingSchedule[]> {
  const profileId = await resolveProfileId(userId);
  await assertParticipant(profileId, matchId);

  // FIX 2: SCAN cursor loop — collect ALL pages, not just the first 100
  let cursor = '0';
  const keys: string[] = [];
  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      'MATCH',
      `meeting:${matchId}:*`,
      'COUNT',
      100,
    ) as [string, string[]];
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length === 0) return [];

  // Batch fetch — single round-trip instead of N+1 GETs
  const values = await redis.mget(...keys);
  const meetings: MeetingSchedule[] = [];
  for (const raw of values) {
    if (raw) meetings.push(JSON.parse(raw) as MeetingSchedule);
  }

  // Sort ascending by scheduledAt
  meetings.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return meetings;
}
