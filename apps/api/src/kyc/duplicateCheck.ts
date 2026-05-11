/**
 * Cross-account duplicate detection for KYC completions.
 *
 * Three independent signals; any single positive flags the verification:
 *   1. Phone SHA-256 hash collision against a prior user
 *   2. Aadhaar reference ID collision against any existing kycVerifications row
 *   3. Face similarity ≥ FACE_SIMILARITY_THRESHOLD against the last N verified
 *      selfies (Rekognition CompareFaces)
 *
 * Returns ordered match candidates so admins can review. Persists the
 * dispatch via kycVerifications.duplicateFlag / duplicateReason.
 */

import { createHash } from 'node:crypto';
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  kycVerifications,
  userDuplicateSignals,
  profiles,
} from '@smartshaadi/db';
import { compareFaces } from './rekognition.js';
import { logger } from '../lib/logger.js';

const FACE_SIMILARITY_THRESHOLD = 0.95;
const FACE_COMPARISON_POOL_SIZE = 50;

export function hashPhone(phone: string): string {
  return createHash('sha256').update(phone.replace(/\s+/g, '')).digest('hex');
}

export interface DuplicateCheckInput {
  userId:        string;
  profileId:     string;
  phone?:        string;
  aadhaarRefId?: string;
  selfieR2Key?:  string;
}

export interface DuplicateCheckResult {
  isDuplicate:     boolean;
  reason:          string | null;
  matchedUserIds:  string[];
  similarityScore: number | null;
}

export async function recordDuplicateSignals(input: DuplicateCheckInput): Promise<void> {
  const phoneHash = input.phone ? hashPhone(input.phone) : null;
  await db
    .insert(userDuplicateSignals)
    .values({
      userId:       input.userId,
      phoneHash,
      aadhaarRefId: input.aadhaarRefId ?? null,
      selfieR2Key:  input.selfieR2Key ?? null,
    })
    .onConflictDoNothing({ target: userDuplicateSignals.userId });
}

export async function checkForDuplicates(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
  const matched = new Set<string>();
  const reasons: string[] = [];
  let topSimilarity: number | null = null;

  if (input.phone) {
    const phoneHash = hashPhone(input.phone);
    const phoneHits = await db
      .select({ userId: userDuplicateSignals.userId })
      .from(userDuplicateSignals)
      .where(and(
        eq(userDuplicateSignals.phoneHash, phoneHash),
        ne(userDuplicateSignals.userId, input.userId),
      ))
      .limit(5);
    for (const r of phoneHits) matched.add(r.userId);
    if (phoneHits.length > 0) reasons.push(`phone hash matches ${phoneHits.length} account(s)`);
  }

  if (input.aadhaarRefId) {
    const aadhaarHits = await db
      .select({ profileId: kycVerifications.profileId })
      .from(kycVerifications)
      .where(and(
        eq(kycVerifications.aadhaarRefId, input.aadhaarRefId),
        ne(kycVerifications.profileId, input.profileId),
      ))
      .limit(5);
    if (aadhaarHits.length > 0) {
      const ids = await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.id, aadhaarHits[0]!.profileId));
      for (const r of ids) matched.add(r.userId);
      reasons.push(`Aadhaar ref matches ${aadhaarHits.length} account(s)`);
    }
  }

  if (input.selfieR2Key) {
    const pool = await db
      .select({
        userId:      userDuplicateSignals.userId,
        selfieR2Key: userDuplicateSignals.selfieR2Key,
      })
      .from(userDuplicateSignals)
      .where(and(
        isNotNull(userDuplicateSignals.selfieR2Key),
        ne(userDuplicateSignals.userId, input.userId),
      ))
      .orderBy(desc(userDuplicateSignals.createdAt))
      .limit(FACE_COMPARISON_POOL_SIZE);

    for (const row of pool) {
      if (!row.selfieR2Key) continue;
      let similarity = 0;
      try {
        similarity = await compareFaces(input.selfieR2Key, row.selfieR2Key);
      } catch (err) {
        logger.warn({ err, candidate: row.userId }, '[duplicateCheck] compareFaces error');
        continue;
      }
      if (similarity >= FACE_SIMILARITY_THRESHOLD) {
        matched.add(row.userId);
        topSimilarity = topSimilarity == null ? similarity : Math.max(topSimilarity, similarity);
      }
    }
    if (topSimilarity != null) {
      reasons.push(`face similarity ${topSimilarity.toFixed(3)} ≥ ${FACE_SIMILARITY_THRESHOLD}`);
    }
  }

  const isDuplicate = matched.size > 0;
  const reason = isDuplicate ? reasons.join('; ') : null;

  if (isDuplicate) {
    const [existing] = await db
      .select({
        existingFlag:   kycVerifications.duplicateFlag,
        existingReason: kycVerifications.duplicateReason,
      })
      .from(kycVerifications)
      .where(eq(kycVerifications.profileId, input.profileId))
      .limit(1);
    const mergedReason = existing?.existingReason
      ? `${existing.existingReason}; ${reason}`
      : reason;
    await db
      .update(kycVerifications)
      .set({ duplicateFlag: true, duplicateReason: mergedReason })
      .where(eq(kycVerifications.profileId, input.profileId));
  }

  return {
    isDuplicate,
    reason,
    matchedUserIds:  Array.from(matched),
    similarityScore: topSimilarity,
  };
}
