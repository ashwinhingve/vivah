/**
 * reputationFeatures.ts — load the 5 reputation signals for a user from
 * the user_reputation_signals rollup table.
 *
 * The signals themselves are computed nightly by behaviorAggregateJob from
 * Postgres (match_requests) + MongoDB (Chat documents) + user_behavior_summary.
 *
 * Cold-start path: when no rollup row exists (user signed up <1 night ago)
 * we return mid-band defaults so the classifier produces a neutral silver
 * tier instead of penalising new users.
 */
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { userReputationSignals } from '@smartshaadi/db';
import type { ReputationFeaturesPayload } from './reputationService.js';

const TIME_CAP_HOURS = 72;
const GHOST_CAP = 10;

const DEFAULT_FEATURES: ReputationFeaturesPayload = {
  response_rate: 0.5,
  message_response_rate: 0.5,
  avg_response_time_hours_norm: 0.5,
  ghost_count_norm: 0.0,
  consistency_score: 0.5,
};

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export async function extractReputationFeatures(
  userId: string,
): Promise<{ features: ReputationFeaturesPayload; ghostCountRaw: number }> {
  const [row] = await db
    .select()
    .from(userReputationSignals)
    .where(eq(userReputationSignals.userId, userId))
    .limit(1);

  if (!row) {
    return { features: DEFAULT_FEATURES, ghostCountRaw: 0 };
  }

  const responseRate = clamp01(Number(row.responseRate));
  const messageResponseRate = clamp01(Number(row.messageResponseRate));
  const avgResponseTimeHoursNorm = clamp01(
    Math.min(Number(row.avgResponseTimeHours), TIME_CAP_HOURS) / TIME_CAP_HOURS,
  );
  const ghostCountRaw = row.ghostCount;
  const ghostCountNorm = clamp01(Math.min(ghostCountRaw, GHOST_CAP) / GHOST_CAP);
  const consistencyScore = clamp01(Number(row.consistencyScore));

  return {
    features: {
      response_rate: responseRate,
      message_response_rate: messageResponseRate,
      avg_response_time_hours_norm: avgResponseTimeHoursNorm,
      ghost_count_norm: ghostCountNorm,
      consistency_score: consistencyScore,
    },
    ghostCountRaw,
  };
}
