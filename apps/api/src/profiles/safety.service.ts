import { eq, or, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, matchRequests, safetyModeUnlocks, user } from '@smartshaadi/db';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

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

  // Rule 2: safetyMode.contactHidden flag in MongoDB
  const model = ProfileContent as unknown as Model<{ userId: string; safetyMode?: { contactHidden?: boolean } }>;
  const contentDoc = await model.findOne({ userId: targetUserId }).select('safetyMode').lean();
  const contactHidden = contentDoc?.safetyMode?.contactHidden ?? true;

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
