/**
 * Smart Shaadi — Profile Views Service
 * apps/api/src/profiles/views.service.ts
 *
 * Tracks profile footprints ("who viewed me") with:
 *   - Self-view suppression
 *   - Incognito mode: viewers in incognito leave no footprint
 *   - 24-hour deduplication per (viewer, viewed) pair
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { mockGet } from '../lib/mockStore.js';
import { profiles, profilePhotos } from '@smartshaadi/db';
import { profileViews } from '@smartshaadi/db';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentViewer {
  viewerProfileId:    string;
  viewedAt:           Date;
  name:               string;
  age:                number | null;
  city:               string | null;
  primaryPhotoKey:    string | null;
  verificationStatus: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type SafetyModeDoc = {
  safetyMode?: {
    incognito?: boolean;
  } | null;
  personal?: {
    fullName?: string;
    dob?: Date | string;
  } | null;
  location?: {
    city?: string;
  } | null;
};

async function loadSafetyMode(userId: string): Promise<{ incognito: boolean }> {
  if (env.USE_MOCK_SERVICES) {
    const doc = mockGet(userId) as SafetyModeDoc | null;
    return { incognito: doc?.safetyMode?.incognito === true };
  }
  const model = ProfileContent as unknown as {
    findOne: (filter: object, projection: object) => { lean: () => Promise<SafetyModeDoc | null> };
  };
  const doc = await model.findOne({ userId }, { 'safetyMode.incognito': 1 }).lean();
  return { incognito: doc?.safetyMode?.incognito === true };
}

async function loadPersonalContent(userId: string): Promise<Pick<SafetyModeDoc, 'personal' | 'location'>> {
  if (env.USE_MOCK_SERVICES) {
    const doc = mockGet(userId) as SafetyModeDoc | null;
    return { personal: doc?.personal ?? null, location: doc?.location ?? null };
  }
  const model = ProfileContent as unknown as {
    findOne: (filter: object, projection: object) => { lean: () => Promise<SafetyModeDoc | null> };
  };
  const doc = await model.findOne({ userId }, { personal: 1, location: 1 }).lean();
  return { personal: doc?.personal ?? null, location: doc?.location ?? null };
}

function calcAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const ms = Date.now() - new Date(dob).getTime();
  const age = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
  return age > 0 ? age : null;
}

// ── trackView ─────────────────────────────────────────────────────────────────

/**
 * Records that `viewerProfileId` (userId: `viewerUserId`) viewed `viewedProfileId`.
 *
 * Rules:
 *   1. Skip self-views.
 *   2. Skip if viewer's safetyMode.incognito === true (no footprint).
 *   3. Deduplicate: if a row for (viewer, viewed) exists within the last 24 h, skip.
 *   4. Otherwise insert a new row.
 */
export async function trackView(
  viewerProfileId: string,
  viewerUserId: string,
  viewedProfileId: string,
): Promise<void> {
  // 1. No self-views
  if (viewerProfileId === viewedProfileId) return;

  // 2. Incognito check — viewers in incognito leave no footprint
  const { incognito } = await loadSafetyMode(viewerUserId);
  if (incognito) return;

  // 3. Deduplicate: check for an existing view within the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existing = await db
    .select({ id: profileViews.id })
    .from(profileViews)
    .where(
      and(
        eq(profileViews.viewerProfileId, viewerProfileId),
        eq(profileViews.viewedProfileId, viewedProfileId),
        sql`${profileViews.viewedAt} >= ${twentyFourHoursAgo}`,
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  // 4. Insert new view row
  await db.insert(profileViews).values({
    viewerProfileId,
    viewedProfileId,
  });
}

// ── getRecentViewers ──────────────────────────────────────────────────────────

/**
 * Returns the most recent unique viewers of `profileId`, enriched with
 * name, age, city, primary photo, and verification status.
 *
 * Deduplication: if the same viewer viewed multiple times, only the most
 * recent view is returned.
 */
export async function getRecentViewers(
  profileId: string,
  limit = 30,
): Promise<RecentViewer[]> {
  // Fetch most recent view per unique viewer (subquery approach via DISTINCT ON pattern
  // using raw SQL for max-per-group deduplication)
  const rows = await db
    .select({
      viewerProfileId: profileViews.viewerProfileId,
      viewedAt:        profileViews.viewedAt,
      userId:          profiles.userId,
      verificationStatus: profiles.verificationStatus,
      primaryPhotoKey: profilePhotos.r2Key,
    })
    .from(profileViews)
    .leftJoin(profiles, eq(profiles.id, profileViews.viewerProfileId))
    .leftJoin(
      profilePhotos,
      and(
        eq(profilePhotos.profileId, profileViews.viewerProfileId),
        eq(profilePhotos.isPrimary, true),
      ),
    )
    .where(eq(profileViews.viewedProfileId, profileId))
    .orderBy(desc(profileViews.viewedAt))
    .limit(limit * 5); // over-fetch to allow dedup below

  // Deduplicate: keep only the most recent view per viewer (rows are ordered desc)
  const seenViewers = new Set<string>();
  const deduplicated: typeof rows = [];
  for (const row of rows) {
    if (!seenViewers.has(row.viewerProfileId)) {
      seenViewers.add(row.viewerProfileId);
      deduplicated.push(row);
      if (deduplicated.length >= limit) break;
    }
  }

  // Enrich each viewer with name / age / city from MongoDB (or mockStore)
  const enriched: RecentViewer[] = await Promise.all(
    deduplicated.map(async (row) => {
      let name = 'Unknown';
      let age: number | null = null;
      let city: string | null = null;

      if (row.userId) {
        const content = await loadPersonalContent(row.userId);
        if (content.personal?.fullName) name = content.personal.fullName;
        if (content.personal?.dob) age = calcAge(content.personal.dob);
        if (content.location?.city) city = content.location.city;
      }

      return {
        viewerProfileId:    row.viewerProfileId,
        viewedAt:           row.viewedAt,
        name,
        age,
        city,
        primaryPhotoKey:    row.primaryPhotoKey ?? null,
        verificationStatus: row.verificationStatus ?? 'PENDING',
      };
    }),
  );

  return enriched;
}
