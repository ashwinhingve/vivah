/**
 * Smart Shaadi — Match Request State Machine
 *
 * Owns the full lifecycle of a match request:
 *   PENDING → ACCEPTED | DECLINED | WITHDRAWN | BLOCKED | EXPIRED
 *
 * Rules:
 * - sender_id / receiver_id map to profile IDs (not user IDs)
 * - Reciprocal block check in both directions before any send
 * - MongoDB Chat document created on ACCEPTED (USE_MOCK_SERVICES guarded)
 * - All notification jobs pushed to Bull notifications queue asynchronously
 */

import { eq, or, and, desc, sql } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { env } from '../../lib/env.js';
import { mockUpsertField } from '../../lib/mockStore.js';
import { matchRequests, blockedUsers, auditLogs } from '@smartshaadi/db';
import { Chat } from '../../infrastructure/mongo/models/Chat.js';
import { notificationsQueue } from '../../infrastructure/redis/queues.js';
import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'BLOCKED'
  | 'EXPIRED';

export interface MatchRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: MatchRequestStatus;
  message: string | null;
  respondedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceError extends Error {
  code: string;
}

// notificationsQueue is shared via infrastructure/redis/queues.ts — never
// re-instantiated per-module.

// ── Error factory ─────────────────────────────────────────────────────────────

function serviceError(code: string, message: string): ServiceError {
  const e = new Error(message) as ServiceError;
  e.code = code;
  return e;
}

// ── sendRequest ───────────────────────────────────────────────────────────────

/**
 * Send a match request from senderId → receiverId.
 *
 * Guards:
 *  1. Cannot send to yourself
 *  2. Cannot send if either party has blocked the other
 *  3. Cannot send if a PENDING request already exists between them
 */
export async function sendRequest(
  senderId: string,
  receiverId: string,
  message?: string,
): Promise<MatchRequest> {
  if (senderId === receiverId) {
    throw serviceError('SELF_REQUEST', 'Cannot send a match request to yourself');
  }

  // Check for any block in either direction
  const blocks = await db
    .select()
    .from(blockedUsers)
    .where(
      or(
        and(eq(blockedUsers.blockerId, senderId), eq(blockedUsers.blockedId, receiverId)),
        and(eq(blockedUsers.blockerId, receiverId), eq(blockedUsers.blockedId, senderId)),
      ),
    );

  if (blocks.length > 0) {
    throw serviceError('BLOCKED', 'Cannot send request — a block relationship exists between these users');
  }

  // Check for an existing PENDING request in either direction
  const existing = await db
    .select()
    .from(matchRequests)
    .where(
      and(
        or(
          and(eq(matchRequests.senderId, senderId), eq(matchRequests.receiverId, receiverId)),
          and(eq(matchRequests.senderId, receiverId), eq(matchRequests.receiverId, senderId)),
        ),
        eq(matchRequests.status, 'PENDING'),
      ),
    );

  if (existing.length > 0) {
    throw serviceError('DUPLICATE_REQUEST', 'A pending request already exists between these users');
  }

  const [created] = await db
    .insert(matchRequests)
    .values({
      senderId,
      receiverId,
      status: 'PENDING',
      message: message ?? null,
    })
    .returning();

  if (!created) {
    throw serviceError('INSERT_FAILED', 'Failed to create match request');
  }

  // Push notification job (fire-and-forget — do not await in request path)
  void notificationsQueue.add(
    'MATCH_REQUEST_RECEIVED',
    {
      type: 'MATCH_REQUEST_RECEIVED',
      userId: receiverId,
      payload: { requestId: created.id, senderId },
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  );

  return created as MatchRequest;
}

// ── acceptRequest ─────────────────────────────────────────────────────────────

/**
 * Accept an incoming match request.
 * Only the receiver may call this. Status must be PENDING.
 * Side-effects:
 *  - Creates a Chat document in MongoDB (or mock store in dev)
 *  - Pushes MATCH_ACCEPTED notification to sender
 */
export async function acceptRequest(
  userId: string,
  requestId: string,
): Promise<MatchRequest> {
  const request = await fetchRequest(requestId);

  if (request.receiverId !== userId) {
    throw serviceError('FORBIDDEN', 'Only the receiver may accept a match request');
  }
  if (request.status !== 'PENDING') {
    throw serviceError('INVALID_STATUS', `Cannot accept a request with status ${request.status}`);
  }

  const [updated] = await db
    .update(matchRequests)
    .set({ status: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(matchRequests.id, requestId))
    .returning();

  if (!updated) {
    throw serviceError('UPDATE_FAILED', 'Failed to accept match request');
  }

  // Create Chat document in MongoDB
  if (env.USE_MOCK_SERVICES) {
    // In mock mode, write to the in-memory store instead of Mongoose
    mockUpsertField(requestId, 'chat', {
      participants: [request.senderId, request.receiverId],
      matchRequestId: requestId,
      messages: [],
      isActive: true,
    });
  } else {
    await Chat.create({
      participants: [request.senderId, request.receiverId],
      matchRequestId: requestId,
      messages: [],
      isActive: true,
    });
  }

  // Push notification to sender
  void notificationsQueue.add(
    'MATCH_ACCEPTED',
    {
      type: 'MATCH_ACCEPTED',
      userId: request.senderId,
      payload: { requestId },
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  );

  return updated as MatchRequest;
}

// ── declineRequest ────────────────────────────────────────────────────────────

/**
 * Decline an incoming match request.
 * Only the receiver may call this. Status must be PENDING.
 */
export async function declineRequest(
  userId: string,
  requestId: string,
): Promise<MatchRequest> {
  const request = await fetchRequest(requestId);

  if (request.receiverId !== userId) {
    throw serviceError('FORBIDDEN', 'Only the receiver may decline a match request');
  }
  if (request.status !== 'PENDING') {
    throw serviceError('INVALID_STATUS', `Cannot decline a request with status ${request.status}`);
  }

  const [updated] = await db
    .update(matchRequests)
    .set({ status: 'DECLINED', respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(matchRequests.id, requestId))
    .returning();

  if (!updated) {
    throw serviceError('UPDATE_FAILED', 'Failed to decline match request');
  }

  return updated as MatchRequest;
}

// ── withdrawRequest ───────────────────────────────────────────────────────────

/**
 * Withdraw a sent match request.
 * Only the sender may call this. Status must be PENDING.
 */
export async function withdrawRequest(
  userId: string,
  requestId: string,
): Promise<MatchRequest> {
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

  if (!updated) {
    throw serviceError('UPDATE_FAILED', 'Failed to withdraw match request');
  }

  return updated as MatchRequest;
}

// ── blockUser ─────────────────────────────────────────────────────────────────

/**
 * Block a user profile.
 * - Inserts a blocked_users record
 * - Cancels any PENDING match_request between them by setting status → BLOCKED
 */
export async function blockUser(
  userId: string,
  targetProfileId: string,
): Promise<void> {
  await db
    .insert(blockedUsers)
    .values({ blockerId: userId, blockedId: targetProfileId })
    .returning();

  // Cancel PENDING + flip ACCEPTED match requests to BLOCKED — blocking a
  // person should also silently break any open conversation, not just stop
  // future requests. The corresponding Chat gets deactivated below.
  const affected = await db
    .update(matchRequests)
    .set({ status: 'BLOCKED', updatedAt: new Date() })
    .where(
      and(
        or(
          eq(matchRequests.status, 'PENDING'),
          eq(matchRequests.status, 'ACCEPTED'),
        ),
        or(
          and(eq(matchRequests.senderId, userId), eq(matchRequests.receiverId, targetProfileId)),
          and(eq(matchRequests.senderId, targetProfileId), eq(matchRequests.receiverId, userId)),
        ),
      ),
    )
    .returning({ id: matchRequests.id });

  // Deactivate each impacted chat so the UI hides it and sockets stop accepting
  // new messages on the room.
  if (affected.length > 0 && !env.USE_MOCK_SERVICES) {
    try {
      await Chat.updateMany(
        { matchRequestId: { $in: affected.map((r) => r.id) } },
        { $set: { isActive: false } },
      );
    } catch (e) {
      console.error('[blockUser] failed to deactivate chats:', e);
    }
  }
  if (affected.length > 0 && env.USE_MOCK_SERVICES) {
    const { mockGet } = await import('../../lib/mockStore.js');
    for (const r of affected) {
      const stored = mockGet(r.id);
      const chat = (stored?.['chat'] as Record<string, unknown> | undefined) ?? {};
      mockUpsertField(r.id, 'chat', { ...chat, isActive: false });
    }
  }
}

// ── reportUser ────────────────────────────────────────────────────────────────

/**
 * Report a user profile for inappropriate behaviour.
 * Writes to audit_logs with event_type='PROFILE_REPORTED' so moderation tools
 * can query, notify the admin queue, and preserve an immutable trail. Also
 * emits a structured console line for external log drains.
 */
export async function reportUser(
  userId: string,
  targetProfileId: string,
  reason: string,
): Promise<void> {
  const payload = { reason, reportedAt: new Date().toISOString() };
  const contentHash = createHash('sha256')
    .update(`${userId}:${targetProfileId}:${reason}:${Date.now()}`)
    .digest('hex');

  try {
    await db.insert(auditLogs).values({
      eventType:   'PROFILE_REPORTED',
      entityType:  'profile',
      entityId:    targetProfileId,
      actorId:     userId,
      payload,
      contentHash,
      prevHash:    null,
    });
  } catch (e) {
    // Don't surface to user — log and continue. Moderation read paths use
    // the console drain as a secondary source when the insert is blocked
    // (e.g. enum mismatch in a partially migrated env).
    console.error('[reportUser] audit insert failed:', e);
  }

  void notificationsQueue.add(
    'PROFILE_REPORTED_MODERATION',
    {
      type:    'PROFILE_REPORTED_MODERATION',
      userId:  'admin',
      payload: { reporterId: userId, targetProfileId, reason },
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  );

  console.info(JSON.stringify({
    event_type:   'PROFILE_REPORTED',
    actor_id:     userId,
    target_id:    targetProfileId,
    metadata:     { reason },
    content_hash: contentHash,
    timestamp:    new Date().toISOString(),
  }));
}

// ── getReceivedRequests ───────────────────────────────────────────────────────

export interface PaginatedRequests {
  requests: MatchRequest[];
  total: number;
}

export async function getReceivedRequests(
  userId: string,
  page: number,
  limit: number,
): Promise<PaginatedRequests> {
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

  const total = Number(countRow?.count ?? 0);

  return { requests: requests as MatchRequest[], total };
}

// ── getSentRequests ───────────────────────────────────────────────────────────

export async function getSentRequests(
  userId: string,
  page: number,
  limit: number,
): Promise<PaginatedRequests> {
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

  const total = Number(countRow?.count ?? 0);

  return { requests: requests as MatchRequest[], total };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchRequest(requestId: string): Promise<MatchRequest> {
  const [request] = await db
    .select()
    .from(matchRequests)
    .where(eq(matchRequests.id, requestId));

  if (!request) {
    throw serviceError('NOT_FOUND', `Match request ${requestId} not found`);
  }

  return request as MatchRequest;
}
