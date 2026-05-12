/**
 * marriageReadinessFeatures.ts
 *
 * Extracts the raw signals needed for the Marriage Readiness Score from:
 *   - PostgreSQL: profile_completeness, partner preferences
 *   - MongoDB Chat: communication depth signals (last 30 days)
 *   - MongoDB ProfileContent: partner_preferences goal clarity booleans
 *
 * CLAUDE.md Rule 11: every Mongo call MUST be guarded with USE_MOCK_SERVICES.
 * CLAUDE.md Rule 12: userId → profileId must be resolved by the caller.
 */
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles } from '@smartshaadi/db';
import { env } from '../lib/env.js';
import { Chat as _Chat } from '../infrastructure/mongo/models/Chat.js';
import { ProfileContent as _ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

// Narrow Mongoose models to minimal interfaces
interface IChatModel extends Model<Record<string, unknown>> {}
interface IProfileContentModel extends Model<Record<string, unknown>> {}

const Chat = _Chat as unknown as IChatModel;
const ProfileContent = _ProfileContent as unknown as IProfileContentModel;

export interface MarriageReadinessRawFeatures {
  /** avg messages per conversation over last 30 days */
  avg_msg_count_per_conv: number;
  /** avg character length of user-sent messages */
  avg_msg_length: number;
  /** profile completeness 0-100 */
  profile_completeness: number;
  /** goal clarity booleans */
  age_pref_set: boolean;
  religion_pref_set: boolean;
  distance_pref_set: boolean;
  education_pref_set: boolean;
  lifestyle_pref_set: boolean;
}

/**
 * Compute communication depth signals from MongoDB Chat documents.
 * Looks at conversations where the user is a participant, over the last 30 days.
 *
 * CLAUDE.md Rule 11: guarded by USE_MOCK_SERVICES — returns zeroes in mock mode.
 */
async function extractCommunicationSignals(
  _userId: string,
  profileId: string,
): Promise<{ avg_msg_count_per_conv: number; avg_msg_length: number }> {
  if (env.USE_MOCK_SERVICES) {
    return { avg_msg_count_per_conv: 0, avg_msg_length: 0 };
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find all chats where this user is a participant
    const rawChats = await Chat
      .find({ participants: profileId })
      .select('messages')
      .lean();

    const chats = (rawChats as unknown) as Array<{
      messages: Array<{
        senderId: string;
        content: string;
        sentAt: Date;
        deletedAt: Date | null;
      }>;
    }>;

    if (chats.length === 0) {
      return { avg_msg_count_per_conv: 0, avg_msg_length: 0 };
    }

    let totalMsgCount = 0;
    let totalLength = 0;
    let totalUserMessages = 0;
    let convsWithActivity = 0;

    for (const chat of chats) {
      const recentMessages = (chat.messages ?? []).filter(
        (m) =>
          m.senderId === profileId &&
          m.deletedAt == null &&
          new Date(m.sentAt) >= thirtyDaysAgo,
      );

      if (recentMessages.length > 0) {
        convsWithActivity++;
        totalMsgCount += recentMessages.length;
        totalLength += recentMessages.reduce(
          (sum, m) => sum + (m.content?.length ?? 0),
          0,
        );
        totalUserMessages += recentMessages.length;
      }
    }

    if (convsWithActivity === 0) {
      return { avg_msg_count_per_conv: 0, avg_msg_length: 0 };
    }

    const avg_msg_count_per_conv = totalMsgCount / convsWithActivity;
    const avg_msg_length =
      totalUserMessages > 0 ? Math.round(totalLength / totalUserMessages) : 0;

    return { avg_msg_count_per_conv, avg_msg_length };
  } catch {
    // Non-fatal — return zeroes
    return { avg_msg_count_per_conv: 0, avg_msg_length: 0 };
  }
}

/**
 * Extract goal clarity booleans from MongoDB ProfileContent partner preferences.
 *
 * CLAUDE.md Rule 11: guarded by USE_MOCK_SERVICES — returns all-false in mock mode.
 */
async function extractGoalClaritySignals(userId: string): Promise<{
  age_pref_set: boolean;
  religion_pref_set: boolean;
  distance_pref_set: boolean;
  education_pref_set: boolean;
  lifestyle_pref_set: boolean;
}> {
  const defaults = {
    age_pref_set: false,
    religion_pref_set: false,
    distance_pref_set: false,
    education_pref_set: false,
    lifestyle_pref_set: false,
  };

  if (env.USE_MOCK_SERVICES) return defaults;

  try {
    const content = await ProfileContent
      .findOne({ userId })
      .select('partnerPreferences')
      .lean() as Record<string, unknown> | null;

    if (!content) return defaults;

    const prefs = content['partnerPreferences'] as Record<string, unknown> | undefined;
    if (!prefs) return defaults;

    return {
      age_pref_set:
        typeof prefs['minAge'] === 'number' && typeof prefs['maxAge'] === 'number',
      religion_pref_set:
        Array.isArray(prefs['religion']) && (prefs['religion'] as unknown[]).length > 0,
      distance_pref_set:
        typeof prefs['maxDistanceKm'] === 'number',
      education_pref_set:
        Array.isArray(prefs['educationLevel']) &&
        (prefs['educationLevel'] as unknown[]).length > 0,
      lifestyle_pref_set:
        Array.isArray(prefs['lifestyleTags']) &&
        (prefs['lifestyleTags'] as unknown[]).length > 0,
    };
  } catch {
    return defaults;
  }
}

/**
 * Extract all features needed for Marriage Readiness scoring.
 *
 * @param userId    Better Auth user.id
 * @param profileId profiles.id UUID (must be resolved by caller — Rule 12)
 */
export async function extractMarriageReadinessFeatures(
  userId: string,
  profileId: string,
): Promise<MarriageReadinessRawFeatures> {
  // ── 1. Postgres: profile completeness ─────────────────────────────────────
  const [profileRow] = await db
    .select({ profileCompleteness: profiles.profileCompleteness })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  const profile_completeness = profileRow?.profileCompleteness ?? 0;

  // ── 2+3. MongoDB: communication signals + goal clarity (parallel) ─────────
  const [commSignals, goalSignals] = await Promise.all([
    extractCommunicationSignals(userId, profileId),
    extractGoalClaritySignals(userId),
  ]);

  return {
    avg_msg_count_per_conv: commSignals.avg_msg_count_per_conv,
    avg_msg_length: commSignals.avg_msg_length,
    profile_completeness: profile_completeness ?? 0,
    ...goalSignals,
  };
}
