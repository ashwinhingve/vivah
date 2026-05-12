/**
 * Smart Shaadi — Family Compatibility Service
 *
 * Phase 3 item 9: lets multiple family members independently rate matches.
 * The system combines individual ratings into a joint family view, surfacing
 * where the user and their family agree or disagree.
 *
 * Weighting (hardcoded — configurable UI is out of scope):
 *   - FATHER, MOTHER, GUARDIAN  → 1.0x
 *   - SIBLING                   → 0.7x
 *   - OTHER (cousin, uncle...)  → 0.5x
 *
 * Joint score formula:
 *   joint = 0.6 * user_match_score + 0.4 * weighted_avg(family_ratings)
 *
 * Agreement % = share of family ratings whose `overallScore` is within
 *   15 points of the user's own implicit match score.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  familyMatchRatings,
  familyMembers,
  parentChildLinks,
  profiles,
  matchScores,
} from '@smartshaadi/db';

// ── Weights ──────────────────────────────────────────────────────────────────

const RELATIONSHIP_WEIGHT: Record<string, number> = {
  FATHER: 1.0, MOTHER: 1.0, GUARDIAN: 1.0,
  SIBLING: 0.7,
  GRANDPARENT: 0.5, UNCLE: 0.5, AUNT: 0.5, COUSIN: 0.5, OTHER: 0.5,
};

const AGREEMENT_DELTA = 15;

// ── Types ────────────────────────────────────────────────────────────────────

export interface FamilyRating {
  id:                    string;
  raterUserId:           string;
  subjectProfileId:      string;
  candidateProfileId:    string;
  overallScore:          number;
  compatibilityConcerns: string[] | null;
  notes:                 string | null;
  ratedAt:               Date;
  raterRelationship:     string | null;
  raterDisplayName:      string | null;
}

export interface JointScoreResult {
  jointScore:        number | null;
  familySignalCount: number;
  agreementPct:      number | null;
  userMatchScore:    number | null;
  familyAvgScore:    number | null;
}

export interface ServiceError extends Error { code: string }
function svcError(code: string, message: string): ServiceError {
  const e = new Error(message) as ServiceError;
  e.code = code;
  return e;
}

// ── Authorization helper ─────────────────────────────────────────────────────

/**
 * Returns the relationship label between raterUserId and subjectProfileId,
 * or null if the rater is not authorized to rate for that subject.
 *
 * Two valid authorization paths:
 *   1. Active parent_child_links (APPROVED, not REVOKED) where rater is the parent
 *   2. family_members row for the subject profile where managerUserId === raterUserId
 */
async function resolveRaterRelationship(
  raterUserId: string,
  subjectProfileId: string,
): Promise<string | null> {
  const [subject] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.id, subjectProfileId))
    .limit(1);

  if (!subject) return null;

  if (subject.userId === raterUserId) return 'SELF';

  const [link] = await db
    .select({ relationship: parentChildLinks.relationship })
    .from(parentChildLinks)
    .where(and(
      eq(parentChildLinks.parentUserId, raterUserId),
      eq(parentChildLinks.childUserId, subject.userId),
      eq(parentChildLinks.childConsentStatus, 'APPROVED'),
      sql`${parentChildLinks.revokedAt} IS NULL`,
    ))
    .limit(1);
  if (link) return link.relationship;

  const [member] = await db
    .select({ relationship: familyMembers.relationship })
    .from(familyMembers)
    .where(and(
      eq(familyMembers.profileId, subjectProfileId),
      eq(familyMembers.managerUserId, raterUserId),
    ))
    .limit(1);

  return member?.relationship ?? null;
}

// ── submitRating ─────────────────────────────────────────────────────────────

export interface SubmitRatingInput {
  raterUserId:          string;
  subjectProfileId:     string;
  candidateProfileId:   string;
  overallScore:         number;
  concerns?:            string[] | undefined;
  notes?:               string | undefined;
}

export async function submitRating(input: SubmitRatingInput): Promise<{
  ratingId: string;
  joint: JointScoreResult;
}> {
  const { raterUserId, subjectProfileId, candidateProfileId, overallScore } = input;

  if (overallScore < 0 || overallScore > 100) {
    throw svcError('INVALID_SCORE', 'overallScore must be between 0 and 100');
  }

  const relationship = await resolveRaterRelationship(raterUserId, subjectProfileId);
  if (!relationship) {
    throw svcError('FORBIDDEN', 'Rater is not authorized to rate on behalf of this subject');
  }

  await db
    .insert(familyMatchRatings)
    .values({
      raterUserId,
      subjectProfileId,
      candidateProfileId,
      overallScore,
      compatibilityConcerns: input.concerns ?? null,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [
        familyMatchRatings.raterUserId,
        familyMatchRatings.candidateProfileId,
        familyMatchRatings.subjectProfileId,
      ],
      set: {
        overallScore,
        compatibilityConcerns: input.concerns ?? null,
        notes: input.notes ?? null,
        ratedAt: new Date(),
      },
    });

  const [rating] = await db
    .select({ id: familyMatchRatings.id })
    .from(familyMatchRatings)
    .where(and(
      eq(familyMatchRatings.raterUserId, raterUserId),
      eq(familyMatchRatings.subjectProfileId, subjectProfileId),
      eq(familyMatchRatings.candidateProfileId, candidateProfileId),
    ))
    .limit(1);

  const joint = await computeJointScore(subjectProfileId, candidateProfileId);
  await persistJointScore(subjectProfileId, candidateProfileId, joint);

  return { ratingId: rating?.id ?? '', joint };
}

// ── getRatings ───────────────────────────────────────────────────────────────

export async function getRatingsForCandidate(
  subjectProfileId: string,
  candidateProfileId: string,
): Promise<FamilyRating[]> {
  const rows = await db
    .select({
      id:                    familyMatchRatings.id,
      raterUserId:           familyMatchRatings.raterUserId,
      subjectProfileId:      familyMatchRatings.subjectProfileId,
      candidateProfileId:    familyMatchRatings.candidateProfileId,
      overallScore:          familyMatchRatings.overallScore,
      compatibilityConcerns: familyMatchRatings.compatibilityConcerns,
      notes:                 familyMatchRatings.notes,
      ratedAt:               familyMatchRatings.ratedAt,
    })
    .from(familyMatchRatings)
    .where(and(
      eq(familyMatchRatings.subjectProfileId, subjectProfileId),
      eq(familyMatchRatings.candidateProfileId, candidateProfileId),
    ));

  return Promise.all(rows.map(async (row) => {
    const rel = await resolveRaterRelationship(row.raterUserId, subjectProfileId);
    return {
      ...row,
      ratedAt: row.ratedAt,
      raterRelationship: rel,
      raterDisplayName: null,
    };
  }));
}

// ── deleteRating ─────────────────────────────────────────────────────────────

export async function deleteRating(
  raterUserId: string,
  ratingId: string,
): Promise<{ subjectProfileId: string; candidateProfileId: string } | null> {
  const [existing] = await db
    .select()
    .from(familyMatchRatings)
    .where(eq(familyMatchRatings.id, ratingId))
    .limit(1);

  if (!existing) return null;
  if (existing.raterUserId !== raterUserId) {
    throw svcError('FORBIDDEN', 'Only the rater can delete their own rating');
  }

  await db.delete(familyMatchRatings).where(eq(familyMatchRatings.id, ratingId));

  const joint = await computeJointScore(existing.subjectProfileId, existing.candidateProfileId);
  await persistJointScore(existing.subjectProfileId, existing.candidateProfileId, joint);

  return {
    subjectProfileId: existing.subjectProfileId,
    candidateProfileId: existing.candidateProfileId,
  };
}

// ── computeJointScore ────────────────────────────────────────────────────────

export async function computeJointScore(
  subjectProfileId: string,
  candidateProfileId: string,
): Promise<JointScoreResult> {
  const ratings = await db
    .select({
      raterUserId:  familyMatchRatings.raterUserId,
      overallScore: familyMatchRatings.overallScore,
    })
    .from(familyMatchRatings)
    .where(and(
      eq(familyMatchRatings.subjectProfileId, subjectProfileId),
      eq(familyMatchRatings.candidateProfileId, candidateProfileId),
    ));

  const [scoreRow] = await db
    .select({ totalScore: matchScores.totalScore })
    .from(matchScores)
    .where(and(
      eq(matchScores.profileA, subjectProfileId),
      eq(matchScores.profileB, candidateProfileId),
    ))
    .limit(1);

  const userMatchScore = scoreRow?.totalScore ?? null;

  if (ratings.length === 0) {
    return { jointScore: null, familySignalCount: 0, agreementPct: null, userMatchScore, familyAvgScore: null };
  }

  const weighted = await Promise.all(ratings.map(async (r) => {
    const rel = await resolveRaterRelationship(r.raterUserId, subjectProfileId);
    const weight = rel && RELATIONSHIP_WEIGHT[rel] ? RELATIONSHIP_WEIGHT[rel]! : 0.5;
    return { score: r.overallScore, weight };
  }));

  const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);
  const familyAvg = totalWeight > 0
    ? weighted.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
    : null;

  const joint = userMatchScore !== null && familyAvg !== null
    ? Math.round(0.6 * userMatchScore + 0.4 * familyAvg)
    : familyAvg !== null
      ? Math.round(familyAvg)
      : null;

  let agreementPct: number | null = null;
  if (userMatchScore !== null && ratings.length > 0) {
    const aligned = ratings.filter((r) =>
      Math.abs(r.overallScore - userMatchScore) <= AGREEMENT_DELTA,
    ).length;
    agreementPct = Math.round((aligned / ratings.length) * 100);
  }

  return {
    jointScore: joint,
    familySignalCount: ratings.length,
    agreementPct,
    userMatchScore,
    familyAvgScore: familyAvg !== null ? Math.round(familyAvg) : null,
  };
}

// ── persistJointScore ────────────────────────────────────────────────────────

/**
 * Upsert the joint score onto match_scores for fast feed-side lookup.
 * Best-effort — failures here are non-fatal because the source of truth lives
 * in family_match_ratings and joint scores are always recomputable.
 */
async function persistJointScore(
  subjectProfileId: string,
  candidateProfileId: string,
  joint: JointScoreResult,
): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: matchScores.id })
      .from(matchScores)
      .where(and(
        eq(matchScores.profileA, subjectProfileId),
        eq(matchScores.profileB, candidateProfileId),
      ))
      .limit(1);

    if (existing) {
      await db
        .update(matchScores)
        .set({
          familyJointScore:   joint.jointScore,
          familySignalCount:  joint.familySignalCount,
          familyAgreementPct: joint.agreementPct,
          updatedAt:          new Date(),
        })
        .where(eq(matchScores.id, existing.id));
    }
  } catch {
    /* non-fatal */
  }
}

// ── batchComputeJointScores (for matchmaking engine integration) ─────────────

/**
 * Batch-fetch family joint score data for many candidates against a single subject.
 * Returns map keyed by candidateProfileId. Returns empty map when no family
 * ratings exist — caller treats absence as "no family signals, omit fields".
 */
export async function batchComputeJointScores(
  subjectProfileId: string,
  candidateProfileIds: string[],
): Promise<Map<string, JointScoreResult>> {
  const result = new Map<string, JointScoreResult>();
  if (candidateProfileIds.length === 0) return result;

  const allRatings = await db
    .select({
      candidateProfileId: familyMatchRatings.candidateProfileId,
      raterUserId:        familyMatchRatings.raterUserId,
      overallScore:       familyMatchRatings.overallScore,
    })
    .from(familyMatchRatings)
    .where(and(
      eq(familyMatchRatings.subjectProfileId, subjectProfileId),
      sql`${familyMatchRatings.candidateProfileId} = ANY(${sql.raw(`ARRAY[${candidateProfileIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')}]::uuid[]`)})`,
    ));

  if (allRatings.length === 0) return result;

  const byCandidate = new Map<string, typeof allRatings>();
  for (const r of allRatings) {
    const arr = byCandidate.get(r.candidateProfileId) ?? [];
    arr.push(r);
    byCandidate.set(r.candidateProfileId, arr);
  }

  for (const [candidateProfileId, ratings] of byCandidate) {
    const joint = await computeJointScore(subjectProfileId, candidateProfileId);
    result.set(candidateProfileId, joint);
    void ratings;
  }

  return result;
}
