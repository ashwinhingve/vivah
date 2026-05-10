/**
 * stayFeatures.ts — extract the 7 Stay Quotient features for a single user.
 *
 * - Resolves Better Auth userId to profiles.id (CLAUDE.md rule #12).
 * - Five features come from PostgreSQL (drizzle).
 * - One feature (messages_sent_last_7d) reads from MongoDB Chat collection;
 *   short-circuits to 0 in mock mode (USE_MOCK_SERVICES=true) since the chat
 *   service itself short-circuits before any Mongo call in dev.
 */
import { and, count, eq, gte, or } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import {
  matchRequests,
  profiles,
  profileViews,
} from '@smartshaadi/db';
import { Chat } from '../infrastructure/mongo/models/Chat.js';
import type { StayFeaturesPayload } from './stayService.js';

interface AppError extends Error {
  code: string;
  status: number;
}

function makeAppError(code: string, message: string, status: number): AppError {
  const e = new Error(message) as AppError;
  e.code = code;
  e.status = status;
  return e;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ProfileSlice {
  id: string;
  lastActiveAt: Date | null;
  profileCompleteness: number | null;
  createdAt: Date;
}

async function loadProfileForUser(userId: string): Promise<ProfileSlice> {
  const [row] = await db
    .select({
      id: profiles.id,
      lastActiveAt: profiles.lastActiveAt,
      profileCompleteness: profiles.profileCompleteness,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!row) {
    throw makeAppError('USER_NOT_FOUND', `No profile for userId=${userId}`, 404);
  }
  return row;
}

async function countMessagesSentLast7d(profileId: string, since: Date): Promise<number> {
  // Mock mode — chat service itself returns [] without touching Mongo, so
  // we can safely report 0. Documented caveat in the plan + module docstring.
  if (env.USE_MOCK_SERVICES) return 0;

  const docs = await Chat.aggregate([
    { $match: { 'messages.senderId': profileId, 'messages.sentAt': { $gte: since } } },
    { $unwind: '$messages' },
    { $match: { 'messages.senderId': profileId, 'messages.sentAt': { $gte: since } } },
    { $count: 'n' },
  ]);
  return Number(docs[0]?.n ?? 0);
}

export async function extractStayFeatures(userId: string): Promise<StayFeaturesPayload> {
  const profile = await loadProfileForUser(userId);

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);

  const lastActiveMs = profile.lastActiveAt?.getTime() ?? profile.createdAt.getTime();
  const days_since_last_login = Math.max(0, (now - lastActiveMs) / DAY_MS);
  const days_since_signup = Math.max(0, (now - profile.createdAt.getTime()) / DAY_MS);

  const [viewsRow] = await db
    .select({ c: count() })
    .from(profileViews)
    .where(
      and(
        eq(profileViews.viewedProfileId, profile.id),
        gte(profileViews.viewedAt, sevenDaysAgo),
      ),
    );

  const [acceptedRow] = await db
    .select({ c: count() })
    .from(matchRequests)
    .where(
      and(
        or(
          eq(matchRequests.senderId, profile.id),
          eq(matchRequests.receiverId, profile.id),
        ),
        eq(matchRequests.status, 'ACCEPTED'),
      ),
    );

  const [pendingRow] = await db
    .select({ c: count() })
    .from(matchRequests)
    .where(
      and(
        or(
          eq(matchRequests.senderId, profile.id),
          eq(matchRequests.receiverId, profile.id),
        ),
        eq(matchRequests.status, 'PENDING'),
      ),
    );

  const messages_sent_last_7d = await countMessagesSentLast7d(profile.id, sevenDaysAgo);

  return {
    user_id: userId,
    days_since_last_login,
    messages_sent_last_7d,
    profile_views_received_7d: Number(viewsRow?.c ?? 0),
    matches_accepted_total: Number(acceptedRow?.c ?? 0),
    profile_completeness: profile.profileCompleteness ?? 0,
    days_since_signup,
    has_active_match_request: Number(pendingRow?.c ?? 0) > 0,
  };
}
