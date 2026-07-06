/**
 * Build the RAG context payload for the Matrimony AI Assistant.
 *
 * Gathers a snapshot of the user's state (profile completeness, top matches,
 * pending requests, profile gaps, last activity) and ships it to the AI
 * service as part of the chat request. Each piece is fetched independently
 * with Promise.all so a slow query never blocks the others; any single
 * failure degrades to a neutral default rather than failing the whole turn.
 */
import { eq, and, or, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  profiles,
  profileSections,
  matchRequests,
  matchScores,
} from '@smartshaadi/db';
import { getTotalUnreadCount } from '../chat/conversations.service.js';

export interface TopMatchEntry {
  profile_id: string;
  display_name: string;
  compatibility_pct: number;
}

export interface RagContext {
  completeness_pct: number;
  tier: string;
  top_matches: TopMatchEntry[];
  pending_requests: number;
  unread_messages: number;
  gaps: string[];
  last_active_iso: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  personal:   'personal details',
  family:     'family',
  career:     'career',
  lifestyle:  'lifestyle',
  horoscope:  'horoscope',
  photos:     'photos',
  preferences: 'partner preferences',
  personality: 'personality',
};

function maskedDisplayName(profileId: string): string {
  return `Match ${profileId.slice(0, 8)}`;
}

export async function buildAssistantContext(
  userId: string,
  profileId: string,
): Promise<RagContext> {
  const [profileRow, sectionsRow, topScores, pendingCount, unreadCount] = await Promise.all([
    db.select({
        completeness: profiles.profileCompleteness,
        tier:         profiles.premiumTier,
        lastActiveAt: profiles.lastActiveAt,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1)
      .then(rows => rows[0])
      .catch(() => undefined),

    db.select()
      .from(profileSections)
      .where(eq(profileSections.profileId, profileId))
      .limit(1)
      .then(rows => rows[0])
      .catch(() => undefined),

    db.select({
        profileA:   matchScores.profileA,
        profileB:   matchScores.profileB,
        totalScore: matchScores.totalScore,
      })
      .from(matchScores)
      .where(or(eq(matchScores.profileA, profileId), eq(matchScores.profileB, profileId)))
      .orderBy(desc(matchScores.totalScore))
      .limit(5)
      .catch(() => []),

    db.select({ id: matchRequests.id })
      .from(matchRequests)
      .where(and(eq(matchRequests.receiverId, profileId), eq(matchRequests.status, 'PENDING')))
      .catch(() => []),

    getTotalUnreadCount(profileId).catch(() => 0),
  ]);

  const completeness_pct = profileRow?.completeness ?? 0;
  const tier             = profileRow?.tier ?? 'FREE';
  const last_active_iso  = profileRow?.lastActiveAt
    ? new Date(profileRow.lastActiveAt).toISOString()
    : null;

  const top_matches: TopMatchEntry[] = topScores.map((row) => {
    const otherId = row.profileA === profileId ? row.profileB : row.profileA;
    return {
      profile_id:        otherId,
      display_name:      maskedDisplayName(otherId),
      compatibility_pct: Math.max(0, Math.min(100, row.totalScore ?? 0)),
    };
  });

  const gaps: string[] = [];
  if (sectionsRow) {
    for (const [key, label] of Object.entries(SECTION_LABELS)) {
      if (sectionsRow[key as keyof typeof sectionsRow] === false) {
        gaps.push(label);
      }
    }
  }

  return {
    completeness_pct,
    tier,
    top_matches,
    pending_requests: pendingCount.length,
    unread_messages:  unreadCount,
    gaps,
    last_active_iso,
  };
}
