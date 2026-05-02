import { eq, or, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import { profiles, matchRequests, safetyModeUnlocks, user } from '@smartshaadi/db';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

export type AllowMessageFrom = 'EVERYONE' | 'VERIFIED_ONLY' | 'SAME_COMMUNITY' | 'ACCEPTED_ONLY';

export interface SafetyModeInput {
  contactHidden?:        boolean | undefined;
  photoHidden?:          boolean | undefined;
  incognito?:            boolean | undefined;
  showLastActive?:       boolean | undefined;
  showReadReceipts?:     boolean | undefined;
  photoBlurUntilUnlock?: boolean | undefined;
  hideFromSearch?:       boolean | undefined;
  allowMessageFrom?:     AllowMessageFrom | undefined;
}

export type PrivacyPreset = 'CONSERVATIVE' | 'BALANCED' | 'OPEN';

export const PRIVACY_PRESETS: Record<PrivacyPreset, Required<SafetyModeInput>> = {
  CONSERVATIVE: {
    contactHidden:        true,
    photoHidden:          true,
    incognito:            true,
    showLastActive:       false,
    showReadReceipts:     false,
    photoBlurUntilUnlock: true,
    hideFromSearch:       true,
    allowMessageFrom:     'VERIFIED_ONLY',
  },
  BALANCED: {
    contactHidden:        true,
    photoHidden:          false,
    incognito:            false,
    showLastActive:       true,
    showReadReceipts:     true,
    photoBlurUntilUnlock: false,
    hideFromSearch:       false,
    allowMessageFrom:     'EVERYONE',
  },
  OPEN: {
    contactHidden:        false,
    photoHidden:          false,
    incognito:            false,
    showLastActive:       true,
    showReadReceipts:     true,
    photoBlurUntilUnlock: false,
    hideFromSearch:       false,
    allowMessageFrom:     'EVERYONE',
  },
};

export async function applyPrivacyPreset(
  userId: string,
  preset: PrivacyPreset,
): Promise<{ safetyMode: SafetyModeInput }> {
  const mode = PRIVACY_PRESETS[preset];
  return updateSafetyMode(userId, mode);
}

export async function getSafetyMode(userId: string): Promise<SafetyModeInput> {
  if (env.USE_MOCK_SERVICES) {
    return (mockGet(userId)?.['safetyMode'] as SafetyModeInput | undefined) ?? {};
  }
  const model = ProfileContent as unknown as Model<{ userId: string; safetyMode?: SafetyModeInput }>;
  const doc = await model.findOne({ userId }).select('safetyMode').lean();
  return doc?.safetyMode ?? {};
}

export interface ContactResponse {
  phoneNumber: string | null;
  email:       string | null;
}

/**
 * Request to unlock contact details for a matched profile.
 * Both parties must have an ACCEPTED match request between their profiles.
 * Idempotent — calling twice for the same pair is safe.
 */
export async function requestContactUnlock(
  requesterId: string,
  targetUserId: string,
): Promise<{ success: boolean; reason?: string }> {
  if (requesterId === targetUserId) {
    return { success: false, reason: 'Cannot unlock contact for yourself' };
  }

  // Resolve profileIds for both users
  const [requesterProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, requesterId))
    .limit(1);

  const [targetProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, targetUserId))
    .limit(1);

  if (!requesterProfile || !targetProfile) {
    return { success: false, reason: 'Profile not found' };
  }

  const requesterId_profile = requesterProfile.id;
  const targetId_profile    = targetProfile.id;

  // Verify an ACCEPTED match exists between these two profiles (either direction)
  const [matchRow] = await db
    .select({ id: matchRequests.id })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.status, 'ACCEPTED'),
        or(
          and(
            eq(matchRequests.senderId,   requesterId_profile),
            eq(matchRequests.receiverId, targetId_profile),
          ),
          and(
            eq(matchRequests.senderId,   targetId_profile),
            eq(matchRequests.receiverId, requesterId_profile),
          ),
        ),
      ),
    )
    .limit(1);

  if (!matchRow) {
    return { success: false, reason: 'No accepted match exists between these profiles' };
  }

  // Insert unlock record (ignore conflict — already unlocked is fine)
  await db
    .insert(safetyModeUnlocks)
    .values({ profileId: targetId_profile, unlockedFor: requesterId_profile })
    .onConflictDoNothing();

  return { success: true };
}

/**
 * Returns contact details if the viewer is allowed to see them.
 * Visibility rules (in order):
 *   1. Viewer is the profile owner → always visible
 *   2. Target profile has safetyMode.contactHidden === false → visible
 *   3. A safetyModeUnlock record exists for (target, viewer) → visible
 *   4. Otherwise → null (hidden)
 */
export async function getContactIfVisible(
  viewerUserId: string,
  targetUserId: string,
): Promise<ContactResponse | null> {
  // Fetch target user row (phone + email live here)
  const [targetUser] = await db
    .select({ id: user.id, phoneNumber: user.phoneNumber, email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!targetUser) return null;

  // Rule 1: viewing own profile
  if (viewerUserId === targetUserId) {
    return { phoneNumber: targetUser.phoneNumber ?? null, email: targetUser.email ?? null };
  }

  // Fetch target profile id
  const [targetProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, targetUserId))
    .limit(1);

  if (!targetProfile) return null;

  // Rule 2: safetyMode.contactHidden flag
  let contactHidden = true;
  if (env.USE_MOCK_SERVICES) {
    const doc = mockGet(targetUserId);
    contactHidden = (doc?.['safetyMode'] as { contactHidden?: boolean } | undefined)?.contactHidden ?? true;
  } else {
    const model = ProfileContent as unknown as Model<{ userId: string; safetyMode?: { contactHidden?: boolean } }>;
    const contentDoc = await model.findOne({ userId: targetUserId }).select('safetyMode').lean();
    contactHidden = contentDoc?.safetyMode?.contactHidden ?? true;
  }

  if (!contactHidden) {
    return { phoneNumber: targetUser.phoneNumber ?? null, email: targetUser.email ?? null };
  }

  // Rule 3: explicit unlock record
  const [viewerProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, viewerUserId))
    .limit(1);

  if (!viewerProfile) return null;

  const [unlockRow] = await db
    .select({ id: safetyModeUnlocks.id })
    .from(safetyModeUnlocks)
    .where(
      and(
        eq(safetyModeUnlocks.profileId,   targetProfile.id),
        eq(safetyModeUnlocks.unlockedFor, viewerProfile.id),
      ),
    )
    .limit(1);

  if (unlockRow) {
    return { phoneNumber: targetUser.phoneNumber ?? null, email: targetUser.email ?? null };
  }

  return null;
}

/**
 * Update the caller's own safetyMode settings in MongoDB ProfileContent.
 * Merges provided fields with existing settings.
 */
export async function updateSafetyMode(
  userId: string,
  input: SafetyModeInput,
): Promise<{ safetyMode: SafetyModeInput }> {
  if (env.USE_MOCK_SERVICES) {
    const existing = (mockGet(userId)?.['safetyMode'] as SafetyModeInput | undefined) ?? {};
    const merged = { ...existing, ...input };
    mockUpsertField(userId, 'safetyMode', merged);
    return { safetyMode: merged };
  }

  const model = ProfileContent as unknown as Model<{ userId: string; safetyMode?: SafetyModeInput }>;
  const existing = (await model.findOne({ userId }).select('safetyMode').lean())?.safetyMode ?? {};
  const merged = { ...existing, ...input };
  await model.updateOne(
    { userId },
    { $set: { safetyMode: merged }, $setOnInsert: { userId } },
    { upsert: true },
  );
  return { safetyMode: merged };
}
