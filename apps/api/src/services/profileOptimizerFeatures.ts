/**
 * profileOptimizerFeatures.ts
 *
 * Extracts the raw fields needed by the Profile Optimizer scorer from
 * PostgreSQL (photo counts) and MongoDB (bio text). Enforces CLAUDE.md
 * Rule 11 (USE_MOCK_SERVICES guard for every Mongo call) and Rule 12
 * (userId → profileId already resolved by the caller before this runs).
 */
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, profilePhotos } from '@smartshaadi/db';
import { env } from '../lib/env.js';
import { ProfileContent as _ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

// Narrow the Mongoose model to the minimal interface we need.
interface IProfileContentModel extends Model<Record<string, unknown>> {}
const ProfileContent = _ProfileContent as unknown as IProfileContentModel;

export interface ProfileOptimizerRawFeatures {
  /** profileId (profiles.id UUID) */
  profileId: string;
  /** Total number of photos (primary + secondary) */
  photo_count: number;
  /** Whether a primary photo is set */
  has_primary_photo: boolean;
  /** Bio text from MongoDB ProfileContent (empty string when unavailable) */
  bio_text: string;
  /** Profile completeness 0-100 from profiles.profileCompleteness */
  profile_completeness: number;
}

/**
 * Extract all features needed for profile optimizer scoring.
 *
 * @param userId  Better Auth user.id
 * @param profileId  profiles.id UUID (must be resolved by caller — Rule 12)
 */
export async function extractProfileOptimizerFeatures(
  userId: string,
  profileId: string,
): Promise<ProfileOptimizerRawFeatures> {
  // ── 1. Postgres: photo count + primary check ──────────────────────────────
  const photoRows = await db
    .select({
      id: profilePhotos.id,
      isPrimary: profilePhotos.isPrimary,
    })
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profileId));

  const photo_count = photoRows.length;
  const has_primary_photo = photoRows.some((p) => p.isPrimary);

  // ── 2. Postgres: profile completeness ────────────────────────────────────
  const [profileRow] = await db
    .select({ profileCompleteness: profiles.profileCompleteness })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  const profile_completeness = profileRow?.profileCompleteness ?? 0;

  // ── 3. MongoDB: bio text (CLAUDE.md Rule 11 — USE_MOCK_SERVICES guard) ───
  let bio_text = '';
  if (!env.USE_MOCK_SERVICES) {
    try {
      const content = await ProfileContent
        .findOne({ userId })
        .select('bio about')
        .lean() as Record<string, unknown> | null;

      if (content) {
        // Try 'bio' field first (direct), fall back to 'about'
        bio_text =
          (content['bio'] as string | undefined) ??
          (content['about'] as string | undefined) ??
          '';
      }
    } catch {
      // Non-fatal — optimizer still works with empty bio
      bio_text = '';
    }
  }

  return {
    profileId,
    photo_count,
    has_primary_photo,
    bio_text,
    profile_completeness: profile_completeness ?? 0,
  };
}
