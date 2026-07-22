/**
 * Video service — Daily.co room creation + meeting scheduling via Redis.
 *
 * Rule 12: always resolve userId → profileId before touching matchRequests
 * (which references profiles.id, not users.id).
 *
 * Phase 7 Sprint G (Unit 7.2): timezone-aware scheduling for NRI pairs.
 */

import { db }              from '../lib/db.js';
import { resolveProfileId as resolveProfileIdCached } from '../lib/profile.js';
import { redis }           from '../lib/redis.js';
import { createRoom, deleteRoom } from '../lib/dailyco.js';
import { Chat }            from '../infrastructure/mongo/models/Chat.js';
import { getIO }           from '../chat/socket/index.js';
import { queueNotification, queueDelayedNotification } from '../infrastructure/redis/queues.js';
import { profiles, matchRequests, virtualDates } from '@smartshaadi/db';
import { eq, or, and, desc, lt, isNull, inArray } from 'drizzle-orm';
import { isValidIcebreakerKey } from './icebreakers.js';
import { resolveTimezone, formatInZone, overlapHours } from '../lib/timezone.js';
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
/** T-15m — the "starting now" alert. Never suppressed; see scheduleDateReminders. */
const IMMINENT_REMINDER_OFFSET_MS = 15 * 60 * 1000;
const REMINDER_OFFSETS_MS = [24 * 60 * 60 * 1000, IMMINENT_REMINDER_OFFSET_MS] as const;

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

/**
 * Resolve both match participants' profiles (with timezone data).
 * Returns [proposer profile, receiver profile], or throws 404 if match invalid.
 */
async function resolveMatchParticipantProfiles(
  matchId: string,
): Promise<Array<{ id: string; ianaTimezone: string | null; countryOfResidence: string }>> {
  const matchRows = await db
    .select({ senderId: matchRequests.senderId, receiverId: matchRequests.receiverId })
    .from(matchRequests)
    .where(eq(matchRequests.id, matchId))
    .limit(1);

  const match = matchRows[0];
  if (!match) throw makeError('NOT_FOUND', 'Match not found', 404);

  const profileRows = await db
    .select({
      id: profiles.id,
      ianaTimezone: profiles.ianaTimezone,
      countryOfResidence: profiles.countryOfResidence,
    })
    .from(profiles)
    .where(or(eq(profiles.id, match.senderId), eq(profiles.id, match.receiverId)));

  const profileMap = new Map(profileRows.map(p => [p.id, p]));
  const proposer = profileMap.get(match.senderId);
  const receiver = profileMap.get(match.receiverId);

  if (!proposer || !receiver) {
    throw makeError('NOT_FOUND', 'Could not resolve all participants', 404);
  }

  return [proposer, receiver];
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

/**
 * Stamp a created room's name onto the nearest upcoming CONFIRMED virtual-date
 * row for a match (best-effort). Called when a live video room is created so the
 * durable record reflects that the date's room was actually opened.
 *
 * Targets the most recent CONFIRMED row for the match that has no room yet — a
 * match has at most one live confirmed date at a time in practice. No-op if none.
 */
async function linkRoomToVirtualDate(matchId: string, roomName: string): Promise<void> {
  const rows = await db
    .select({ id: virtualDates.id })
    .from(virtualDates)
    .where(and(
      eq(virtualDates.matchId, matchId),
      eq(virtualDates.status, 'CONFIRMED'),
      isNull(virtualDates.roomName),
    ))
    .orderBy(desc(virtualDates.scheduledAt))
    .limit(1);

  const target = rows[0];
  if (!target) return;

  await db.update(virtualDates)
    .set({ roomName, updatedAt: new Date() })
    .where(eq(virtualDates.id, target.id));
}

// ── Lifecycle sweep (hardening) ───────────────────────────────────────────────
//
// Without this, a durable virtual_dates row never reaches a terminal state on
// its own: a PROPOSED date nobody answers sits PROPOSED forever (its Redis
// proposal quietly expires via TTL), and a CONFIRMED date nobody joins/rates
// sits CONFIRMED forever. This sweep closes both, and is the only writer of the
// NO_SHOW status. Pure status transitions on already-past dates — no user
// messaging — so it is safe to run pre-launch (same posture as tokenCleanup).

/** A PROPOSED date this long past its start with no response is treated as expired. */
const PROPOSED_EXPIRY_GRACE_MS = 15 * 60 * 1000;   // 15 min
/** A CONFIRMED date whose end + this grace passed with zero ratings is a NO_SHOW. */
const NO_SHOW_GRACE_MS         = 60 * 60 * 1000;    // 1 h

export interface VirtualDateSweepResult {
  /** Stale PROPOSED rows transitioned to CANCELLED (nobody ever responded). */
  expired: number;
  /** CONFIRMED rows transitioned to NO_SHOW (ended, neither side rated). */
  noShow:  number;
}

/**
 * Advance stalled virtual dates to their terminal states. Exported for the
 * BullMQ worker and for unit testing without the queue wrapper.
 *
 *  1. PROPOSED  &  scheduledAt < now − 15m               → CANCELLED (expired)
 *  2. CONFIRMED &  scheduledAt + durationMin + 1h < now
 *               &  neither participant rated             → NO_SHOW
 *
 * A CONFIRMED date where at least one side rated is left untouched — someone
 * showed up; it either completes via the second rating or lingers as a
 * one-sided record, which is a truer signal than NO_SHOW.
 */
export async function sweepVirtualDateLifecycle(
  now: Date = new Date(),
): Promise<VirtualDateSweepResult> {
  // 1. Expire unanswered proposals.
  const expiredCutoff = new Date(now.getTime() - PROPOSED_EXPIRY_GRACE_MS);
  const expiredRows = await db.update(virtualDates)
    .set({ status: 'CANCELLED', updatedAt: now })
    .where(and(
      eq(virtualDates.status, 'PROPOSED'),
      lt(virtualDates.scheduledAt, expiredCutoff),
    ))
    .returning({ id: virtualDates.id });

  // 2. NO_SHOW confirmed dates that ended with no feedback from either side.
  //    Pre-filter on scheduledAt (a coarse but correct superset: end =
  //    scheduledAt + duration + grace, and duration ≥ 0, so any due row has
  //    scheduledAt < now − grace), then refine per-row with the real duration.
  const confirmedCutoff = new Date(now.getTime() - NO_SHOW_GRACE_MS);
  const candidates = await db.select({
      id:          virtualDates.id,
      scheduledAt: virtualDates.scheduledAt,
      durationMin: virtualDates.durationMin,
    })
    .from(virtualDates)
    .where(and(
      eq(virtualDates.status, 'CONFIRMED'),
      isNull(virtualDates.proposerRating),
      isNull(virtualDates.inviteeRating),
      lt(virtualDates.scheduledAt, confirmedCutoff),
    ));

  const dueIds = candidates
    .filter((c) => {
      const endMs = new Date(c.scheduledAt).getTime() + c.durationMin * 60_000;
      return endMs + NO_SHOW_GRACE_MS <= now.getTime();
    })
    .map((c) => c.id);

  let noShow = 0;
  if (dueIds.length > 0) {
    const noShowRows = await db.update(virtualDates)
      .set({ status: 'NO_SHOW', updatedAt: now })
      .where(inArray(virtualDates.id, dueIds))
      .returning({ id: virtualDates.id });
    noShow = noShowRows.length;
  }

  return { expired: expiredRows.length, noShow };
}

/**
 * Enhanced MeetingSchedule with timezone metadata and scheduling hints.
 * This wraps the base MeetingSchedule with additional NRI-aware fields.
 */
export interface MeetingScheduleWithTimezone {
  // Base fields (from MeetingSchedule)
  id:          string;
  matchId:     string;
  proposedBy:  string;
  scheduledAt: string;
  durationMin: number;
  roomUrl:     string | null;
  status:      'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes:       string | null;

  // Timezone enhancements (Phase 7 Sprint G, Unit 7.2)
  proposerTz?:        string;      // Proposer's IANA timezone
  inviteeTz?:         string;      // Invitee's IANA timezone
  proposerLocal?:     string;      // Proposer's local rendering (e.g., "3/15/2026, 20:30:00")
  inviteeLocal?:      string;      // Invitee's local rendering
  overlapWindow?:     {            // Civil-hours overlap for this pair
    startUtc: string;              // ISO-8601 UTC
    endUtc:   string;              // ISO-8601 UTC
    label:    string;              // Human-readable (e.g. "13:00–16:30 UTC")
  } | null;
}

/**
 * Enrich a MeetingSchedule with timezone and overlap metadata.
 * Best-effort: if profile lookup or timezone resolution fails, returns base meeting without enrichment.
 */
async function enrichMeetingWithTimezone(
  meeting: MeetingSchedule,
  matchId: string,
): Promise<MeetingScheduleWithTimezone> {
  const enriched: MeetingScheduleWithTimezone = { ...meeting };

  try {
    const profiles = await resolveMatchParticipantProfiles(matchId);
    if (profiles.length < 2) return enriched;

    const proposerProfile = profiles[0];
    const inviteeProfile = profiles[1];

    if (!proposerProfile || !inviteeProfile) {
      return enriched;
    }

    const proposerTz = resolveTimezone({
      ianaTimezone: proposerProfile.ianaTimezone,
      countryOfResidence: proposerProfile.countryOfResidence,
    });
    const inviteeTz = resolveTimezone({
      ianaTimezone: inviteeProfile.ianaTimezone,
      countryOfResidence: inviteeProfile.countryOfResidence,
    });

    enriched.proposerTz = proposerTz;
    enriched.inviteeTz = inviteeTz;

    // Render the scheduled time in each participant's timezone
    const scheduledDate = new Date(meeting.scheduledAt);
    const proposerLocal = formatInZone(scheduledDate, proposerTz);
    const inviteeLocal = formatInZone(scheduledDate, inviteeTz);
    if (proposerLocal) enriched.proposerLocal = proposerLocal;
    if (inviteeLocal) enriched.inviteeLocal = inviteeLocal;

    // Compute civil-hours overlap window as a scheduling hint
    const overlap = overlapHours(proposerTz, inviteeTz);
    if (overlap) {
      enriched.overlapWindow = {
        startUtc: overlap.startUtc.toISOString(),
        endUtc:   overlap.endUtc.toISOString(),
        label:    overlap.label,
      };
    }
  } catch {
    // Non-fatal enrichment failure — return base meeting
  }

  return enriched;
}

/**
 * Schedule timezone-aware MEETING_REMINDER notifications (T-24h, T-15m) for both participants.
 *
 * Each participant gets reminders at times that are reasonable in their local timezone
 * (08:00–22:00). If a reminder would fire outside civil hours, it's skipped (non-fatal
 * enhancement — the meeting itself proceeds).
 */
async function scheduleDateReminders(
  matchId: string,
  meetingId: string,
  scheduledAt: string,
  userIds: (string | null)[],
): Promise<void> {
  const startMs = new Date(scheduledAt).getTime();
  const nowMs   = Date.now();

  let profiles: Array<{ id: string; ianaTimezone: string | null; countryOfResidence: string }> = [];
  try {
    profiles = await resolveMatchParticipantProfiles(matchId);
  } catch {
    // Fall back to simple (non-timezone-aware) scheduling if profile lookup fails.
    // The match may have been deleted; reminders are best-effort anyway.
    for (const userId of userIds) {
      if (!userId) continue;
      for (const offset of REMINDER_OFFSETS_MS) {
        const delay = startMs - offset - nowMs;
        await queueDelayedNotification(
          { userId, type: 'MEETING_REMINDER', payload: { matchId, meetingId, scheduledAt } },
          delay,
          `vd-remind-${offset}-${meetingId}-${userId}`,
        ).catch(() => {
          // Non-fatal
        });
      }
    }
    return;
  }

  // Map profileId → timezone for each user
  const userIdToTimezone = new Map<string | null, string>();
  for (const profile of profiles) {
    const tz = resolveTimezone({
      ianaTimezone: profile.ianaTimezone,
      countryOfResidence: profile.countryOfResidence,
    });
    // Best-effort: resolve profileId → userId for this user
    const userIdForProfile = await resolveUserIdFromProfileId(profile.id).catch(() => null);
    if (userIdForProfile) {
      userIdToTimezone.set(userIdForProfile, tz);
    }
  }

  // For each user, schedule reminders only if they fire during civil hours (08:00–22:00 local)
  for (const userId of userIds) {
    if (!userId) continue;
    const userTz = userIdToTimezone.get(userId);
    const tz: string = userTz ?? 'Asia/Kolkata'; // Fallback if lookup fails

    for (const offset of REMINDER_OFFSETS_MS) {
      const reminderUtcDate = new Date(startMs - offset);
      const reminderLocalStr = formatInZone(reminderUtcDate, tz);

      // Parse local time to check if it's in civil hours (08:00–22:00)
      let isInCivilHours = true;
      if (reminderLocalStr) {
        // reminderLocalStr format: "MM/DD/YYYY, HH:mm:ss" (from formatInZone default)
        const parts = reminderLocalStr.split(', ');
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          const hourStr = timeParts[0];
          if (hourStr) {
            const hour = parseInt(hourStr, 10);
            isInCivilHours = hour >= 8 && hour < 22;
          }
        }
      }

      // Civil-hours suppression applies ONLY to the far-out T-24h courtesy nudge.
      //
      // The T-15m reminder must ALWAYS fire. It is the "your date starts now"
      // alert, and the user chose that slot deliberately — suppressing it because
      // 06:45 local looks unsociable means they simply miss their date. That
      // would also regress the single thing Sprint F set out to fix (the reminder
      // that never fired), and it would bite hardest on exactly the cross-border
      // pairs this unit exists to serve: a narrow India<->North America overlap
      // pushes dates into early-morning and late-night slots by necessity.
      const isImminentReminder = offset === IMMINENT_REMINDER_OFFSET_MS;
      if (!isInCivilHours && !isImminentReminder) {
        continue;
      }

      const delay = startMs - offset - nowMs;
      await queueDelayedNotification(
        { userId, type: 'MEETING_REMINDER', payload: { matchId, meetingId, scheduledAt } },
        delay,
        `vd-remind-${offset}-${meetingId}-${userId}`,
      ).catch(() => {
        // Non-fatal — reminders are an enhancement
      });
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

  // Link the live room back to the durable virtual-date row (best-effort).
  // Stamps roomName onto the nearest upcoming CONFIRMED date for this match so
  // the durable history records that a room was actually opened — and the
  // lifecycle sweep can distinguish "room opened, no feedback" from a true
  // NO_SHOW. Never blocks the call flow (same posture as appendSystemMessage).
  await linkRoomToVirtualDate(input.matchId, room.name).catch(() => { /* non-fatal */ });

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
): Promise<MeetingScheduleWithTimezone> {
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

  // Enrich with timezone metadata (Phase 7 Sprint G, Unit 7.2)
  return enrichMeetingWithTimezone(meeting, input.matchId);
}

// ── respondMeeting ────────────────────────────────────────────────────────────

export async function respondMeeting(
  userId: string,
  matchId: string,
  meetingId: string,
  input: RespondMeetingInput,
): Promise<MeetingScheduleWithTimezone> {
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
    // Schedule timezone-aware T-24h / T-15m reminders for BOTH participants.
    // `userId` is the responder (invitee); proposerUserId resolved above.
    await scheduleDateReminders(matchId, meetingId, meeting.scheduledAt, [userId, proposerUserId])
      .catch(() => { /* non-fatal — reminders are an enhancement */ });
  }

  // Enrich with timezone metadata (Phase 7 Sprint G, Unit 7.2)
  return enrichMeetingWithTimezone(updated, matchId);
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
): Promise<MeetingScheduleWithTimezone[]> {
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

  // Enrich each meeting with timezone metadata (Phase 7 Sprint G, Unit 7.2)
  const enriched: MeetingScheduleWithTimezone[] = [];
  for (const meeting of meetings) {
    const withTz = await enrichMeetingWithTimezone(meeting, matchId);
    enriched.push(withTz);
  }

  return enriched;
}
