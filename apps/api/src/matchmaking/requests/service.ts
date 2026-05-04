/**
 * Smart Shaadi — Match Request State Machine + Privacy
 *
 * Lifecycle: PENDING → ACCEPTED | DECLINED | WITHDRAWN | BLOCKED | EXPIRED
 *
 * Rules:
 *  - sender_id / receiver_id always profile UUIDs (not user IDs)
 *  - Reciprocal block check both directions before any send
 *  - PENDING auto-expires after MATCH_REQUEST_TTL_DAYS (sweeper worker)
 *  - Reciprocal pending: if A→B and B→A both PENDING, accept fast-tracks both
 *  - Cool-off: declined sender cannot re-request same receiver for COOLDOWN_DAYS
 *  - SUPER_LIKE priority: bypasses daily quota (handled in router) + receiver
 *    sees a highlighted card
 *  - All notification jobs pushed to BullMQ; never await in request path
 */

import { eq, or, and, desc, sql, inArray, gt, lt } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { env } from '../../lib/env.js';
import { mockUpsertField, mockGet } from '../../lib/mockStore.js';
import {
  matchRequests,
  blockedUsers,
  matchRequestReports,
  profiles,
  profilePhotos,
} from '@smartshaadi/db';
import { Chat } from '../../infrastructure/mongo/models/Chat.js';
import { notificationsQueue } from '../../infrastructure/redis/queues.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MATCH_REQUEST_TTL_DAYS = 14;
export const DECLINE_COOLDOWN_DAYS = 30;
export const REPORT_COOLDOWN_DAYS  = 7;

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchRequestStatus =
  | 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'BLOCKED' | 'EXPIRED';

export type MatchRequestPriority = 'NORMAL' | 'SUPER_LIKE';

export type ReportCategory =
  | 'HARASSMENT' | 'FAKE_PROFILE' | 'INAPPROPRIATE_CONTENT'
  | 'SCAM' | 'UNDERAGE' | 'SPAM' | 'OTHER';

export type DeclineReason =
  | 'NOT_INTERESTED' | 'NOT_MATCHING_PREFERENCES' | 'INCOMPLETE_PROFILE'
  | 'PHOTO_HIDDEN' | 'INAPPROPRIATE_MESSAGE' | 'OTHER';

export interface MatchRequest {
  id:                string;
  senderId:          string;
  receiverId:        string;
  status:            MatchRequestStatus;
  priority:          MatchRequestPriority;
  message:           string | null;
  acceptanceMessage: string | null;
  declineReason:     string | null;
  seenAt:            Date | null;
  respondedAt:       Date | null;
  expiresAt:         Date | null;
  createdAt:         Date;
  updatedAt:         Date;
}

export interface ServiceError extends Error {
  code: string;
}

// ── Error helper ──────────────────────────────────────────────────────────────

function serviceError(code: string, message: string): ServiceError {
  const e = new Error(message) as ServiceError;
  e.code = code;
  return e;
}

/**
 * Enqueue a notification for the recipient identified by their `profiles.id`.
 *
 * The notifications service contract uses Better Auth `user.id` as the delivery
 * key — it joins `user`, `notification_preferences`, `device_tokens` by
 * user.id. Matchmaking holds profile IDs only (sender/receiver of the match
 * request), so we pass the profileId through and the notifications worker
 * resolves it before delivery (see notifications/service.ts).
 *
 * Sentinel `'admin'` is not a profile UUID — the worker treats it as a
 * moderator routing key.
 */
function pushNotify(type: string, recipientProfileId: string, payload: Record<string, unknown>): void {
  void notificationsQueue.add(
    type,
    {
      type,
      // Worker uses `profileId` first, falling back to `userId` for backwards
      // compatibility with non-matchmaking callers that already supply user.id.
      profileId: recipientProfileId,
      userId:    recipientProfileId,
      payload,
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  );
}

// ── sendRequest ───────────────────────────────────────────────────────────────

export interface SendRequestInput {
  message?:  string | undefined;
  priority?: MatchRequestPriority | undefined;
}

/**
 * Send a match request from senderId → receiverId.
 *
 * Guards:
 *  1. Cannot send to yourself
 *  2. Cannot send if either party blocked the other
 *  3. Cannot send if ACCEPTED or PENDING already exists between them
 *  4. Cool-off after a recent DECLINE from this receiver
 *  5. Reciprocal-pending detection: if receiver already has a PENDING request
 *     directed at sender, sender's "send" is silently treated as an ACCEPT
 */
export async function sendRequest(
  senderId: string,
  receiverId: string,
  input: SendRequestInput = {},
): Promise<MatchRequest> {
  if (senderId === receiverId) {
    throw serviceError('SELF_REQUEST', 'Cannot send a match request to yourself');
  }

  // 1. Blocks check
  const blocks = await db
    .select()
    .from(blockedUsers)
    .where(or(
      and(eq(blockedUsers.blockerId, senderId), eq(blockedUsers.blockedId, receiverId)),
      and(eq(blockedUsers.blockerId, receiverId), eq(blockedUsers.blockedId, senderId)),
    ));
  if (blocks.length > 0) {
    throw serviceError('BLOCKED', 'A block relationship exists between these profiles');
  }

  // 2. Existing pending / accepted check
  const open = await db
    .select()
    .from(matchRequests)
    .where(and(
      or(
        and(eq(matchRequests.senderId, senderId), eq(matchRequests.receiverId, receiverId)),
        and(eq(matchRequests.senderId, receiverId), eq(matchRequests.receiverId, senderId)),
      ),
      inArray(matchRequests.status, ['PENDING', 'ACCEPTED'] as MatchRequestStatus[]),
    ));

  if (open.length > 0) {
    const reciprocal = open.find((r) => r.senderId === receiverId && r.status === 'PENDING');
    if (reciprocal) {
      // Reciprocal pending — fast-accept both sides
      const accepted = await acceptRequest(senderId, reciprocal.id);
      return accepted;
    }
    const accepted = open.find((r) => r.status === 'ACCEPTED');
    if (accepted) {
      throw serviceError('ALREADY_MATCHED', 'You already have an active match with this profile');
    }
    throw serviceError('DUPLICATE_REQUEST', 'A pending request already exists between these profiles');
  }

  // 3. Decline cool-off
  const cutoff = new Date(Date.now() - DECLINE_COOLDOWN_DAYS * 86_400_000);
  const recentDecline = await db
    .select({ id: matchRequests.id, updatedAt: matchRequests.updatedAt })
    .from(matchRequests)
    .where(and(
      eq(matchRequests.senderId, senderId),
      eq(matchRequests.receiverId, receiverId),
      eq(matchRequests.status, 'DECLINED'),
      gt(matchRequests.updatedAt, cutoff),
    ))
    .limit(1);
  if (recentDecline.length > 0) {
    throw serviceError(
      'COOLDOWN_ACTIVE',
      `This profile recently declined an interest. You can try again after the ${DECLINE_COOLDOWN_DAYS}-day cool-off period.`,
    );
  }

  const expiresAt = new Date(Date.now() + MATCH_REQUEST_TTL_DAYS * 86_400_000);
  const priority: MatchRequestPriority = input.priority ?? 'NORMAL';

  const [created] = await db
    .insert(matchRequests)
    .values({
      senderId,
      receiverId,
      status:   'PENDING',
      priority,
      message:  input.message ?? null,
      expiresAt,
    })
    .returning();

  if (!created) throw serviceError('INSERT_FAILED', 'Failed to create match request');

  pushNotify(
    priority === 'SUPER_LIKE' ? 'MATCH_REQUEST_SUPER_LIKE' : 'MATCH_REQUEST_RECEIVED',
    receiverId,
    { requestId: created.id, senderId, priority },
  );

  return created as MatchRequest;
}

// ── acceptRequest ─────────────────────────────────────────────────────────────

export interface AcceptRequestInput {
  welcomeMessage?: string | undefined;
}

/**
 * Accept a PENDING match request. `callerProfileId` is the receiver's
 * `profiles.id` (NOT Better Auth `user.id`). Resolve via
 * `db.select({id: profiles.id}).from(profiles).where(eq(profiles.userId, ...))`
 * before invoking — see CLAUDE.md rule 12.
 */
export async function acceptRequest(
  callerProfileId: string,
  requestId: string,
  input: AcceptRequestInput = {},
): Promise<MatchRequest> {
  const userId = callerProfileId; // body keeps legacy alias; column refs are profile.id keys
  const request = await fetchRequest(requestId);

  if (request.receiverId !== userId) {
    throw serviceError('FORBIDDEN', 'Only the receiver may accept a match request');
  }
  if (request.status !== 'PENDING') {
    throw serviceError('INVALID_STATUS', `Cannot accept a request with status ${request.status}`);
  }

  const [updated] = await db
    .update(matchRequests)
    .set({
      status:            'ACCEPTED',
      acceptanceMessage: input.welcomeMessage ?? null,
      respondedAt:       new Date(),
      seenAt:            request.seenAt ?? new Date(),
      updatedAt:         new Date(),
    })
    .where(eq(matchRequests.id, requestId))
    .returning();

  if (!updated) throw serviceError('UPDATE_FAILED', 'Failed to accept match request');

  // Mongo Chat document — use mock store in dev
  if (env.USE_MOCK_SERVICES) {
    mockUpsertField(requestId, 'chat', {
      participants:    [request.senderId, request.receiverId],
      matchRequestId:  requestId,
      messages:        [],
      isActive:        true,
      welcomeMessage:  input.welcomeMessage ?? null,
    });
  } else {
    await Chat.create({
      participants:    [request.senderId, request.receiverId],
      matchRequestId:  requestId,
      messages:        [],
      isActive:        true,
    });
  }

  pushNotify('MATCH_ACCEPTED', request.senderId, {
    requestId,
    welcomeMessage: input.welcomeMessage ?? null,
  });

  return updated as MatchRequest;
}

// ── declineRequest ────────────────────────────────────────────────────────────

export interface DeclineRequestInput {
  reason?: DeclineReason | undefined;
}

/** Decline a PENDING request. `callerProfileId` = receiver's `profiles.id`. */
export async function declineRequest(
  callerProfileId: string,
  requestId: string,
  input: DeclineRequestInput = {},
): Promise<MatchRequest> {
  const userId = callerProfileId;
  const request = await fetchRequest(requestId);

  if (request.receiverId !== userId) {
    throw serviceError('FORBIDDEN', 'Only the receiver may decline a match request');
  }
  if (request.status !== 'PENDING') {
    throw serviceError('INVALID_STATUS', `Cannot decline a request with status ${request.status}`);
  }

  const [updated] = await db
    .update(matchRequests)
    .set({
      status:        'DECLINED',
      declineReason: input.reason ?? null,
      respondedAt:   new Date(),
      seenAt:        request.seenAt ?? new Date(),
      updatedAt:     new Date(),
    })
    .where(eq(matchRequests.id, requestId))
    .returning();

  if (!updated) throw serviceError('UPDATE_FAILED', 'Failed to decline match request');

  // Sender does NOT learn the decline reason — only an opaque "declined" notification
  // (matrimony etiquette). Reason kept internal for moderation + ML signal.
  pushNotify('MATCH_DECLINED', request.senderId, { requestId });

  return updated as MatchRequest;
}

// ── withdrawRequest ───────────────────────────────────────────────────────────

/** Withdraw a PENDING request. `callerProfileId` = sender's `profiles.id`. */
export async function withdrawRequest(callerProfileId: string, requestId: string): Promise<MatchRequest> {
  const userId = callerProfileId;
  const request = await fetchRequest(requestId);

  if (request.senderId !== userId) {
    throw serviceError('FORBIDDEN', 'Only the sender may withdraw a match request');
  }
  if (request.status !== 'PENDING') {
    throw serviceError('INVALID_STATUS', `Cannot withdraw a request with status ${request.status}`);
  }

  const [updated] = await db
    .update(matchRequests)
    .set({ status: 'WITHDRAWN', updatedAt: new Date() })
    .where(eq(matchRequests.id, requestId))
    .returning();

  if (!updated) throw serviceError('UPDATE_FAILED', 'Failed to withdraw match request');

  // Notify the receiver only if they had already seen it — silent withdraw
  // before "seen" is the polite default (no read-receipt, no ghost trail).
  if (request.seenAt) {
    pushNotify('MATCH_WITHDRAWN', request.receiverId, { requestId });
  }

  return updated as MatchRequest;
}

// ── markRequestSeen ───────────────────────────────────────────────────────────

/**
 * Marks a received request as seen by the receiver. First call sets seenAt;
 * subsequent calls no-op. Triggers a "seen" notification to the sender if
 * they have read-receipts allowed in their privacy settings (handled at
 * router layer; service is unconditional for now).
 */
export async function markRequestSeen(callerProfileId: string, requestId: string): Promise<MatchRequest> {
  const userId = callerProfileId;
  const request = await fetchRequest(requestId);

  if (request.receiverId !== userId) {
    throw serviceError('FORBIDDEN', 'Only the receiver may mark a request as seen');
  }
  if (request.seenAt) return request;

  const [updated] = await db
    .update(matchRequests)
    .set({ seenAt: new Date(), updatedAt: new Date() })
    .where(eq(matchRequests.id, requestId))
    .returning();

  if (!updated) throw serviceError('UPDATE_FAILED', 'Failed to mark request as seen');

  return updated as MatchRequest;
}

// ── blockUser / unblockUser / listBlockedUsers ────────────────────────────────

/** Block another profile. `callerProfileId` = blocker's `profiles.id`. */
export async function blockUser(
  callerProfileId: string,
  targetProfileId: string,
  reason?: string,
): Promise<void> {
  const userId = callerProfileId;
  if (userId === targetProfileId) {
    throw serviceError('SELF_BLOCK', 'You cannot block yourself');
  }

  await db
    .insert(blockedUsers)
    .values({ blockerId: userId, blockedId: targetProfileId, reason: reason ?? null })
    .onConflictDoNothing()
    .returning();

  // Cancel PENDING + flip ACCEPTED match requests to BLOCKED
  const affected = await db
    .update(matchRequests)
    .set({ status: 'BLOCKED', updatedAt: new Date() })
    .where(and(
      inArray(matchRequests.status, ['PENDING', 'ACCEPTED'] as MatchRequestStatus[]),
      or(
        and(eq(matchRequests.senderId, userId), eq(matchRequests.receiverId, targetProfileId)),
        and(eq(matchRequests.senderId, targetProfileId), eq(matchRequests.receiverId, userId)),
      ),
    ))
    .returning({ id: matchRequests.id });

  // Deactivate impacted chats
  if (affected.length > 0) {
    if (env.USE_MOCK_SERVICES) {
      for (const r of affected) {
        const stored = mockGet(r.id);
        const chat = (stored?.['chat'] as Record<string, unknown> | undefined) ?? {};
        mockUpsertField(r.id, 'chat', { ...chat, isActive: false });
      }
    } else {
      try {
        await Chat.updateMany(
          { matchRequestId: { $in: affected.map((r) => r.id) } },
          { $set: { isActive: false } },
        );
      } catch (e) {
        console.error('[blockUser] chat deactivation failed:', e);
      }
    }
  }
}

/** Unblock a previously-blocked profile. `callerProfileId` = blocker's `profiles.id`. */
export async function unblockUser(callerProfileId: string, targetProfileId: string): Promise<void> {
  const userId = callerProfileId;
  await db
    .delete(blockedUsers)
    .where(and(
      eq(blockedUsers.blockerId, userId),
      eq(blockedUsers.blockedId, targetProfileId),
    ));
}

export interface BlockedUserItem {
  blockId:         string;
  profileId:       string;
  name:            string | null;
  primaryPhotoKey: string | null;
  reason:          string | null;
  blockedAt:       string;
}

/**
 * Returns the caller's blocked list, enriched with display name + primary photo.
 */
/** List profiles blocked by the caller. `callerProfileId` = caller's `profiles.id`. */
export async function listBlockedUsers(callerProfileId: string): Promise<BlockedUserItem[]> {
  const userId = callerProfileId;
  const rows = await db
    .select({
      blockId:    blockedUsers.id,
      profileId:  blockedUsers.blockedId,
      reason:     blockedUsers.reason,
      blockedAt:  blockedUsers.createdAt,
      userId:     profiles.userId,
    })
    .from(blockedUsers)
    .leftJoin(profiles, eq(profiles.id, blockedUsers.blockedId))
    .where(eq(blockedUsers.blockerId, userId))
    .orderBy(desc(blockedUsers.createdAt));

  if (rows.length === 0) return [];

  const profileIds = rows.map((r) => r.profileId);
  const photos = await db
    .select({ profileId: profilePhotos.profileId, r2Key: profilePhotos.r2Key })
    .from(profilePhotos)
    .where(and(inArray(profilePhotos.profileId, profileIds), eq(profilePhotos.isPrimary, true)));
  const photoByProfile = new Map(photos.map((p) => [p.profileId, p.r2Key]));

  type ContentDoc = { personal?: { fullName?: string } };
  const nameByUser = new Map<string, string>();
  const userIds = rows.map((r) => r.userId).filter((u): u is string => Boolean(u));
  if (env.USE_MOCK_SERVICES) {
    for (const uid of userIds) {
      const doc = mockGet(uid) as ContentDoc | null;
      if (doc?.personal?.fullName) nameByUser.set(uid, doc.personal.fullName);
    }
  } else {
    const { ProfileContent } = await import('../../infrastructure/mongo/models/ProfileContent.js');
    const Content = ProfileContent as unknown as {
      find: (filter: object) => { lean: () => Promise<Array<ContentDoc & { userId: string }>> };
    };
    const docs = await Content.find({ userId: { $in: userIds } }).lean();
    for (const d of docs) if (d.userId && d.personal?.fullName) nameByUser.set(d.userId, d.personal.fullName);
  }

  return rows.map((r) => ({
    blockId:         r.blockId,
    profileId:       r.profileId,
    name:            r.userId ? nameByUser.get(r.userId) ?? null : null,
    primaryPhotoKey: photoByProfile.get(r.profileId) ?? null,
    reason:          r.reason,
    blockedAt:       r.blockedAt.toISOString(),
  }));
}

// ── reportUser ────────────────────────────────────────────────────────────────

export interface ReportUserInput {
  category:   ReportCategory;
  details?:   string | undefined;
  requestId?: string | undefined;
}

export async function reportUser(
  reporterId: string,
  reportedProfileId: string,
  input: ReportUserInput,
): Promise<{ reportId: string }> {
  if (reporterId === reportedProfileId) {
    throw serviceError('SELF_REPORT', 'You cannot report yourself');
  }

  // De-dupe: same reporter→reported within REPORT_COOLDOWN_DAYS is a no-op
  const cutoff = new Date(Date.now() - REPORT_COOLDOWN_DAYS * 86_400_000);
  const recent = await db
    .select({ id: matchRequestReports.id })
    .from(matchRequestReports)
    .where(and(
      eq(matchRequestReports.reporterId, reporterId),
      eq(matchRequestReports.reportedId, reportedProfileId),
      eq(matchRequestReports.category, input.category),
      gt(matchRequestReports.createdAt, cutoff),
    ))
    .limit(1);
  if (recent.length > 0 && recent[0]) {
    return { reportId: recent[0].id };
  }

  const [row] = await db
    .insert(matchRequestReports)
    .values({
      reporterId,
      reportedId:  reportedProfileId,
      category:    input.category,
      details:     input.details ?? null,
      requestId:   input.requestId ?? null,
      status:      'OPEN',
    })
    .returning({ id: matchRequestReports.id });

  if (!row) throw serviceError('INSERT_FAILED', 'Failed to record report');

  pushNotify('PROFILE_REPORTED_MODERATION', 'admin', {
    reportId:   row.id,
    reporterId,
    reportedId: reportedProfileId,
    category:   input.category,
  });

  return { reportId: row.id };
}

// ── expireOldRequests (sweeper) ───────────────────────────────────────────────

/**
 * Flips PENDING requests with expiresAt < now to EXPIRED. Notifies the sender
 * for each expired request. Idempotent. Safe to run on a daily cron.
 */
export async function expireOldRequests(): Promise<{ expired: number }> {
  const now = new Date();
  const expired = await db
    .update(matchRequests)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(and(
      eq(matchRequests.status, 'PENDING'),
      lt(matchRequests.expiresAt, now),
    ))
    .returning({ id: matchRequests.id, senderId: matchRequests.senderId });

  for (const row of expired) {
    pushNotify('MATCH_REQUEST_EXPIRED', row.senderId, { requestId: row.id });
  }

  return { expired: expired.length };
}

// ── Pagination ─────────────────────────────────────────────────────────────────

export interface PaginatedRequests {
  requests: MatchRequest[];
  total:    number;
}

/** Page of requests received by the caller. `callerProfileId` = receiver's `profiles.id`. */
export async function getReceivedRequests(
  callerProfileId: string,
  page: number,
  limit: number,
): Promise<PaginatedRequests> {
  const userId = callerProfileId;
  const offset = (page - 1) * limit;

  const requests = await db
    .select()
    .from(matchRequests)
    .where(eq(matchRequests.receiverId, userId))
    .orderBy(desc(matchRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(matchRequests)
    .where(eq(matchRequests.receiverId, userId));

  return {
    requests: requests as MatchRequest[],
    total:    Number(countRow?.count ?? 0),
  };
}

/** Page of requests sent by the caller. `callerProfileId` = sender's `profiles.id`. */
export async function getSentRequests(
  callerProfileId: string,
  page: number,
  limit: number,
): Promise<PaginatedRequests> {
  const userId = callerProfileId;
  const offset = (page - 1) * limit;

  const requests = await db
    .select()
    .from(matchRequests)
    .where(eq(matchRequests.senderId, userId))
    .orderBy(desc(matchRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(matchRequests)
    .where(eq(matchRequests.senderId, userId));

  return {
    requests: requests as MatchRequest[],
    total:    Number(countRow?.count ?? 0),
  };
}

// ── Enriched requests ─────────────────────────────────────────────────────────

export interface EnrichedRequest {
  id:                string;
  status:            MatchRequestStatus;
  priority:          MatchRequestPriority;
  message:           string | null;
  acceptanceMessage: string | null;
  declineReason:     string | null;
  seenAt:            string | null;
  respondedAt:       string | null;
  expiresAt:         string | null;
  createdAt:         string;
  // Counterparty:
  profileId:         string;
  userId:            string | null;
  name:              string | null;
  age:               number | null;
  city:              string | null;
  primaryPhotoKey:   string | null;
  isVerified:        boolean;
  manglik:           'YES' | 'NO' | 'PARTIAL' | null;
  lastActiveAt:      string | null;
}

type EnrichSide = 'received' | 'sent';

/**
 * Enriches a page of received or sent requests with counterparty profile
 * details (name, age, city, photo, verified, manglik, lastActiveAt). Honours
 * the counterparty's `safetyMode.showLastActive` flag.
 */
export async function getEnrichedRequests(
  userId: string,
  side: EnrichSide,
  page: number,
  limit: number,
): Promise<{ requests: EnrichedRequest[]; total: number }> {
  const base = side === 'received'
    ? await getReceivedRequests(userId, page, limit)
    : await getSentRequests(userId, page, limit);

  if (base.requests.length === 0) return { requests: [], total: base.total };

  const counterIds = side === 'received'
    ? base.requests.map((r) => r.senderId)
    : base.requests.map((r) => r.receiverId);
  const uniqueIds = Array.from(new Set(counterIds));

  const profileRows = await db
    .select()
    .from(profiles)
    .where(inArray(profiles.id, uniqueIds));

  const photoRows = await db
    .select()
    .from(profilePhotos)
    .where(and(inArray(profilePhotos.profileId, uniqueIds), eq(profilePhotos.isPrimary, true)));

  const profileById = new Map(profileRows.map((p) => [p.id, p]));
  const photoById = new Map(photoRows.map((p) => [p.profileId, p.r2Key]));

  type ContentDoc = {
    userId?:    string;
    personal?:  { fullName?: string; dob?: string };
    location?:  { city?: string };
    horoscope?: { manglik?: 'YES' | 'NO' | 'PARTIAL' };
    safetyMode?:{ showLastActive?: boolean; photoHidden?: boolean };
  };
  const userIds = profileRows.map((p) => p.userId);
  const contentByUserId = new Map<string, ContentDoc>();
  if (env.USE_MOCK_SERVICES) {
    for (const uid of userIds) {
      const doc = mockGet(uid) as ContentDoc | null;
      if (doc) contentByUserId.set(uid, doc);
    }
  } else {
    const { ProfileContent } = await import('../../infrastructure/mongo/models/ProfileContent.js');
    const Content = ProfileContent as unknown as {
      find: (filter: object) => { lean: () => Promise<ContentDoc[]> };
    };
    const docs = await Content.find({ userId: { $in: userIds } }).lean();
    for (const d of docs) if (d.userId) contentByUserId.set(d.userId, d);
  }

  const enriched: EnrichedRequest[] = base.requests.map((r) => {
    const counterId = side === 'received' ? r.senderId : r.receiverId;
    const p = profileById.get(counterId);
    const c = p ? contentByUserId.get(p.userId) : undefined;
    const dob = c?.personal?.dob;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000)) : null;
    const showLastActive = c?.safetyMode?.showLastActive !== false; // default true
    const photoHidden = c?.safetyMode?.photoHidden === true;
    return {
      id:                r.id,
      status:            r.status,
      priority:          r.priority,
      message:           r.message,
      acceptanceMessage: r.acceptanceMessage,
      declineReason:     r.declineReason,
      seenAt:            r.seenAt ? new Date(r.seenAt).toISOString() : null,
      respondedAt:       r.respondedAt ? new Date(r.respondedAt).toISOString() : null,
      expiresAt:         r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      createdAt:         new Date(r.createdAt).toISOString(),
      profileId:         counterId,
      userId:            p?.userId ?? null,
      name:              c?.personal?.fullName ?? null,
      age:               age && age > 0 ? age : null,
      city:              c?.location?.city ?? null,
      primaryPhotoKey:   photoHidden ? null : photoById.get(counterId) ?? null,
      isVerified:        p?.verificationStatus === 'VERIFIED',
      manglik:           c?.horoscope?.manglik ?? null,
      lastActiveAt:      showLastActive && p?.lastActiveAt ? p.lastActiveAt.toISOString() : null,
    };
  });

  return { requests: enriched, total: base.total };
}

// ── getWhoLikedMe ─────────────────────────────────────────────────────────────

export interface WhoLikedMeItem {
  requestId:        string;
  senderProfileId:  string;
  message:          string | null;
  priority:         MatchRequestPriority;
  createdAt:        Date;
  name:             string | null;
  age:              number | null;
  city:             string | null;
  primaryPhotoKey:  string | null;
  manglik:          'YES' | 'NO' | 'PARTIAL' | null;
  lastActiveAt:     string | null;
  isVerified:       boolean;
}

export async function getWhoLikedMe(
  receiverProfileId: string,
  limit: number,
): Promise<{ items: WhoLikedMeItem[]; total: number }> {
  const requests = await db
    .select()
    .from(matchRequests)
    .where(and(eq(matchRequests.receiverId, receiverProfileId), eq(matchRequests.status, 'PENDING')))
    .orderBy(desc(matchRequests.priority), desc(matchRequests.createdAt))
    .limit(limit);

  if (requests.length === 0) return { items: [], total: 0 };

  const senderIds = Array.from(new Set(requests.map((r) => r.senderId)));
  const profileRows = await db.select().from(profiles).where(inArray(profiles.id, senderIds));
  const photoRows = await db
    .select()
    .from(profilePhotos)
    .where(and(inArray(profilePhotos.profileId, senderIds), eq(profilePhotos.isPrimary, true)));
  const profileById = new Map(profileRows.map((p) => [p.id, p]));
  const photoById = new Map(photoRows.map((p) => [p.profileId, p.r2Key]));

  type ContentDoc = {
    userId?:    string;
    personal?:  { fullName?: string; dob?: string };
    location?:  { city?: string };
    horoscope?: { manglik?: 'YES' | 'NO' | 'PARTIAL' };
    safetyMode?:{ showLastActive?: boolean };
  };
  const userIds = profileRows.map((p) => p.userId);
  const contentByUserId = new Map<string, ContentDoc>();
  if (env.USE_MOCK_SERVICES) {
    for (const uid of userIds) {
      const doc = mockGet(uid) as ContentDoc | null;
      if (doc) contentByUserId.set(uid, doc);
    }
  } else {
    const { ProfileContent } = await import('../../infrastructure/mongo/models/ProfileContent.js');
    const Content = ProfileContent as unknown as {
      find: (filter: object) => { lean: () => Promise<ContentDoc[]> };
    };
    const docs = await Content.find({ userId: { $in: userIds } }).lean();
    for (const d of docs) if (d.userId) contentByUserId.set(d.userId, d);
  }

  const items: WhoLikedMeItem[] = requests.map((r) => {
    const p = profileById.get(r.senderId);
    const c = p ? contentByUserId.get(p.userId) : undefined;
    const dob = c?.personal?.dob;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000)) : null;
    const showLastActive = c?.safetyMode?.showLastActive !== false;
    return {
      requestId:       r.id,
      senderProfileId: r.senderId,
      message:         r.message ?? null,
      priority:        r.priority as MatchRequestPriority,
      createdAt:       r.createdAt,
      name:            c?.personal?.fullName ?? null,
      age:             age && age > 0 ? age : null,
      city:            c?.location?.city ?? null,
      primaryPhotoKey: photoById.get(r.senderId) ?? null,
      manglik:         c?.horoscope?.manglik ?? null,
      lastActiveAt:    showLastActive && p?.lastActiveAt ? p.lastActiveAt.toISOString() : null,
      isVerified:      p?.verificationStatus === 'VERIFIED',
    };
  });

  return { items, total: items.length };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchRequest(requestId: string): Promise<MatchRequest> {
  const [request] = await db.select().from(matchRequests).where(eq(matchRequests.id, requestId));
  if (!request) throw serviceError('NOT_FOUND', `Match request ${requestId} not found`);
  return request as MatchRequest;
}
