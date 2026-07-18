/**
 * Shared at-risk candidate selection + Stay Quotient scoring (Unit 7.3).
 *
 * Extracted so the admin at-risk route AND the daily churn-recovery sweep use
 * the SAME candidate query + bounded-concurrency scoring — no duplication, no
 * drift between what an admin sees and what the sweep acts on.
 */
import { asc, isNull, or, lt } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { profiles } from '@smartshaadi/db';
import { extractStayFeatures } from '../services/stayFeatures.js';
import { getStayQuotient, type StayQuotientResponse } from '../services/stayService.js';

/** Bound the AI fan-out; admins/sweep page over the scored result set. */
export const AT_RISK_CANDIDATE_CAP = 100;
const SCORE_CONCURRENCY = 10;
const INACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface AtRiskCandidate {
  id:     string;   // profiles.id
  userId: string;   // Better Auth user.id
}

/**
 * Profiles that are stale (no activity in 7d) or never active, oldest first.
 * Capped so the downstream AI scoring stays bounded.
 */
export async function selectAtRiskCandidates(cap = AT_RISK_CANDIDATE_CAP): Promise<AtRiskCandidate[]> {
  const cutoff = new Date(Date.now() - INACTIVITY_WINDOW_MS);
  return db
    .select({ id: profiles.id, userId: profiles.userId })
    .from(profiles)
    .where(or(isNull(profiles.lastActiveAt), lt(profiles.lastActiveAt, cutoff)))
    .orderBy(asc(profiles.lastActiveAt))
    .limit(cap);
}

/**
 * Score candidates via the Stay Quotient AI service in bounded-concurrency
 * batches (each score is a round trip). Failed scores are logged and skipped,
 * never fatal. Returns scored results sorted by churn probability (desc).
 */
export async function scoreCandidates(candidates: AtRiskCandidate[]): Promise<StayQuotientResponse[]> {
  const scored: StayQuotientResponse[] = [];
  for (let i = 0; i < candidates.length; i += SCORE_CONCURRENCY) {
    const batch = candidates.slice(i, i + SCORE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (c) => {
        const features = await extractStayFeatures(c.userId);
        return getStayQuotient(features);
      }),
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') scored.push(r.value);
      else logger.warn({ err: r.reason, userId: batch[idx]!.userId }, 'at_risk_score_failed');
    });
  }
  scored.sort((a, b) => b.churn_probability - a.churn_probability);
  return scored;
}
