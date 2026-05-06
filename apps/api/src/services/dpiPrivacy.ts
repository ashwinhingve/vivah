/**
 * dpiPrivacy.ts — Privacy enforcement for the Divorce Probability Indicator (DPI).
 *
 * All DPI access is gated through these helpers:
 *  - assertRequesterParticipation: verify the caller is a participant in an ACCEPTED match
 *  - buildCacheKey: requester-scoped Redis key (prevents cross-user cache leakage)
 *  - sanitizeForLogging: strips raw score/narrative before Sentry/PostHog
 */
import { createHash } from 'node:crypto';
import { eq, and, or } from 'drizzle-orm';
import { matchRequests } from '@smartshaadi/db';
import { db as drizzleDb } from '../lib/db.js';

// ── Error ─────────────────────────────────────────────────────────────────────

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

export class DpiPrivacyError extends Error {
  public readonly code = 'DPI_PRIVACY_VIOLATION';
  public readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = 'DpiPrivacyError';
  }
}

// ── DpiResponse (minimal subset for sanitizeForLogging) ───────────────────────

export interface DpiResponse {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  label: string;
  narrative: string;
  suggestion: string;
  top_factors: Array<{ factor: string; weight: number; direction: string }>;
  shared_strengths: string[];
  disclaimer: string;
  computed_at: string;
  fallback?: boolean;
}

// ── assertRequesterParticipation ──────────────────────────────────────────────

/**
 * Verify the requester is a participant in the match.
 * Returns { otherProfileId } for ACCEPTED matches.
 *
 * CRITICAL:
 * - Throws DpiPrivacyError (403) if caller is not a participant in any state.
 * - Throws AppError('MATCH_NOT_FOUND', 404) for non-existent OR non-ACCEPTED
 *   matches — to prevent existence leaks (caller must not know if a PENDING
 *   match exists between two other users).
 */
export async function assertRequesterParticipation(
  requesterProfileId: string,
  matchId: string,
  db: typeof drizzleDb,
): Promise<{ otherProfileId: string }> {
  // First check: does the requester participate in ANY state of this match?
  const [anyMatch] = await db
    .select({
      id:         matchRequests.id,
      senderId:   matchRequests.senderId,
      receiverId: matchRequests.receiverId,
      status:     matchRequests.status,
    })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.id, matchId),
        or(
          eq(matchRequests.senderId, requesterProfileId),
          eq(matchRequests.receiverId, requesterProfileId),
        ),
      ),
    )
    .limit(1);

  if (!anyMatch) {
    // Either match doesn't exist at all, or the user is not a participant.
    // Return 404 either way — prevents existence leak (PENDING match between
    // two other users should not be distinguishable from non-existent match).
    throw makeAppError('MATCH_NOT_FOUND', 'Match not found', 404);
  }

  // Requester IS a participant — now enforce ACCEPTED status only.
  if (anyMatch.status !== 'ACCEPTED') {
    // Non-ACCEPTED match: return 404, NOT 403 — prevents revealing
    // to the requester that a PENDING/REJECTED match exists.
    throw makeAppError('MATCH_NOT_FOUND', 'Match not found', 404);
  }

  const otherProfileId =
    anyMatch.senderId === requesterProfileId ? anyMatch.receiverId : anyMatch.senderId;

  return { otherProfileId };
}

// ── buildCacheKey ─────────────────────────────────────────────────────────────

/**
 * Build the Redis cache key for a DPI result.
 * Scoped to userId (not matchId) — the other participant cannot access this key.
 */
export function buildCacheKey(requesterUserId: string, matchId: string): string {
  return `dpi:${requesterUserId}:${matchId}`;
}

// ── sanitizeForLogging ────────────────────────────────────────────────────────

/**
 * Strip sensitive fields before logging to Sentry/PostHog.
 * NEVER include: score (float), narrative text, factor breakdowns.
 * Safe fields: level bucket (LOW/MEDIUM/HIGH), timestamp, anonymized hash.
 */
export function sanitizeForLogging(
  response: DpiResponse,
  requesterUserId: string,
): { requester_hash: string; level: string; computed_at: string } {
  return {
    requester_hash: createHash('sha256').update(requesterUserId).digest('hex').slice(0, 12),
    level: response.level,
    computed_at: response.computed_at,
  };
}
