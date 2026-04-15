// apps/api/src/profiles/community.service.ts

import { db } from '../lib/db.js';
import { profiles, communityZones } from '@smartshaadi/db';
import { eq } from 'drizzle-orm';
import type { CommunityZoneData } from '@smartshaadi/types';
import type { UpdateCommunityZoneInput } from '@smartshaadi/schemas';

/** Resolve the profile UUID from a user UUID. Returns null if the profile doesn't exist. */
async function getProfileId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

function mapToResponse(row: typeof communityZones.$inferSelect): CommunityZoneData {
  return {
    ...(row.community    != null && { community:    row.community }),
    ...(row.subCommunity != null && { subCommunity: row.subCommunity }),
    ...(row.motherTongue != null && { motherTongue: row.motherTongue }),
    ...(row.preferredLang != null && { preferredLang: row.preferredLang }),
    lgbtqProfile: row.lgbtqProfile ?? false,
  };
}

export async function getCommunityZone(userId: string): Promise<CommunityZoneData | null> {
  const profileId = await getProfileId(userId);
  if (!profileId) return null;

  const rows = await db
    .select()
    .from(communityZones)
    .where(eq(communityZones.profileId, profileId))
    .limit(1);

  return rows[0] ? mapToResponse(rows[0]) : null;
}

export async function updateCommunityZone(
  userId: string,
  data: UpdateCommunityZoneInput,
): Promise<CommunityZoneData | null> {
  const profileId = await getProfileId(userId);
  if (!profileId) return null;

  const setValue: Partial<typeof communityZones.$inferInsert> = { updatedAt: new Date() };
  if (data.community    != null) setValue.community    = data.community;
  if (data.subCommunity != null) setValue.subCommunity = data.subCommunity;
  if (data.motherTongue != null) setValue.motherTongue = data.motherTongue;
  if (data.preferredLang != null) setValue.preferredLang = data.preferredLang;
  if (data.lgbtqProfile != null) setValue.lgbtqProfile  = data.lgbtqProfile;

  const rows = await db
    .insert(communityZones)
    .values({ profileId, ...setValue })
    .onConflictDoUpdate({ target: communityZones.profileId, set: setValue })
    .returning();

  return rows[0] ? mapToResponse(rows[0]) : null;
}
