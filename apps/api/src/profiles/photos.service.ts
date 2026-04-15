import { eq, and, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, profilePhotos, profileSections } from '@smartshaadi/db';
import { getPhotoUrls } from '../storage/service.js';
import type { PhotoUploadInput, PhotoReorderInput, SetPrimaryPhotoInput } from '@smartshaadi/schemas';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 8;

// Section weights for completeness score
const SECTION_WEIGHTS = {
  personal:    20,
  photos:      20,
  family:      15,
  career:      15,
  lifestyle:   10,
  horoscope:   10,
  preferences: 10,
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PhotoResult {
  id:           string;
  r2Key:        string;
  url:          string | null;
  isPrimary:    boolean;
  displayOrder: number;
  uploadedAt:   Date;
}

// ── Service functions ──────────────────────────────────────────────────────────

/**
 * Add a profile photo after the file has been uploaded to R2 via presigned URL.
 * Handles primary photo assignment, ordering, section marking, and completeness recalculation.
 */
export async function addProfilePhoto(
  userId: string,
  data: PhotoUploadInput,
): Promise<PhotoResult> {
  // 1. Find profile by userId
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (!profile) {
    throw Object.assign(new Error('Profile not found'), { name: 'PROFILE_NOT_FOUND' });
  }

  // 2. Count existing photos for this profile
  const existingPhotos = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profile.id));

  if (existingPhotos.length >= MAX_PHOTOS) {
    throw Object.assign(new Error('Photo limit reached'), { name: 'PHOTO_LIMIT_REACHED' });
  }

  // 3. Auto-set isPrimary: first photo is always primary, or explicit true
  const isPrimary = (data.isPrimary ?? false) || existingPhotos.length === 0;

  // 4. Auto-set displayOrder: append after existing
  const displayOrder = data.displayOrder ?? existingPhotos.length;

  // 5. If setting as primary, unset all other photos
  if (isPrimary) {
    await db
      .update(profilePhotos)
      .set({ isPrimary: false })
      .where(eq(profilePhotos.profileId, profile.id));
  }

  // 6. Insert new photo
  const [newPhoto] = await db
    .insert(profilePhotos)
    .values({
      profileId: profile.id,
      r2Key: data.r2Key,
      isPrimary,
      displayOrder,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    })
    .returning();

  if (!newPhoto) {
    throw new Error('Failed to insert photo');
  }

  // 7. Update profileSections: set photos=true
  const [existingSection] = await db
    .select()
    .from(profileSections)
    .where(eq(profileSections.profileId, profile.id));

  if (existingSection) {
    await db
      .update(profileSections)
      .set({ photos: true, updatedAt: new Date() })
      .where(eq(profileSections.profileId, profile.id));
  } else {
    await db
      .insert(profileSections)
      .values({
        profileId: profile.id,
        photos: true,
      });
  }

  // 8. Recalculate completeness score
  await recalculateScore(profile.id);

  // 9. Generate presigned GET URL
  const [url] = await getPhotoUrls([newPhoto.r2Key]);

  // 10. Return PhotoResult
  return {
    id: newPhoto.id,
    r2Key: newPhoto.r2Key,
    url: url ?? null,
    isPrimary: newPhoto.isPrimary,
    displayOrder: newPhoto.displayOrder,
    uploadedAt: newPhoto.uploadedAt,
  };
}

/**
 * Get all photos for a user's profile, with presigned URLs.
 */
export async function getProfilePhotos(userId: string): Promise<PhotoResult[]> {
  // 1. Find profile by userId
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (!profile) {
    throw Object.assign(new Error('Profile not found'), { name: 'PROFILE_NOT_FOUND' });
  }

  // 2. Select photos ordered by displayOrder asc, then uploadedAt asc
  const photos = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profile.id))
    .orderBy(asc(profilePhotos.displayOrder), asc(profilePhotos.uploadedAt));

  // 3. Generate presigned URLs
  const urls = await getPhotoUrls(photos.map(p => p.r2Key));

  // 4. Return PhotoResult array
  return photos.map((p, i) => ({
    id: p.id,
    r2Key: p.r2Key,
    url: urls[i] ?? null,
    isPrimary: p.isPrimary,
    displayOrder: p.displayOrder,
    uploadedAt: p.uploadedAt,
  }));
}

/**
 * Delete a photo record by photo UUID, verifying ownership.
 * If the deleted photo was primary, promotes the next photo.
 * If no photos remain, marks photos section as incomplete.
 */
export async function deleteProfilePhoto(
  userId: string,
  photoId: string,
): Promise<void> {
  // 1. Find profile by userId
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (!profile) {
    throw Object.assign(new Error('Profile not found'), { name: 'PROFILE_NOT_FOUND' });
  }

  // 2. Find photo by id AND profileId (ownership check)
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.profileId, profile.id)));

  if (!photo) {
    throw Object.assign(new Error('Photo not found'), { name: 'PHOTO_NOT_FOUND' });
  }

  // 3. Was it primary?
  const wasPrimary = photo.isPrimary;

  // 4. Delete the photo
  await db
    .delete(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.profileId, profile.id)));

  // 5. If it was primary, promote next photo
  if (wasPrimary) {
    const [nextPhoto] = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.profileId, profile.id))
      .orderBy(asc(profilePhotos.displayOrder))
      .limit(1);

    if (nextPhoto) {
      await db
        .update(profilePhotos)
        .set({ isPrimary: true })
        .where(eq(profilePhotos.id, nextPhoto.id));
    }
  }

  // 6. Count remaining photos
  const remaining = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profile.id));

  if (remaining.length === 0) {
    // Update profileSections to set photos=false
    await db
      .update(profileSections)
      .set({ photos: false, updatedAt: new Date() })
      .where(eq(profileSections.profileId, profile.id));
  }

  // 7. Recalculate completeness
  await recalculateScore(profile.id);
}

/**
 * Reorder multiple photos by updating displayOrder for each.
 * All updates happen in a transaction.
 */
export async function reorderPhotos(
  userId: string,
  data: PhotoReorderInput,
): Promise<void> {
  // 1. Find profile by userId
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (!profile) {
    throw Object.assign(new Error('Profile not found'), { name: 'PROFILE_NOT_FOUND' });
  }

  // 2. Perform updates in a transaction
  await db.transaction(async (tx) => {
    for (const item of data) {
      const result = await tx
        .update(profilePhotos)
        .set({ displayOrder: item.displayOrder })
        .where(
          and(
            eq(profilePhotos.id, item.id),
            eq(profilePhotos.profileId, profile.id),
          ),
        );

      if ((result.rowCount ?? 0) === 0) {
        throw Object.assign(new Error('Photo not found'), { name: 'PHOTO_NOT_FOUND' });
      }
    }
  });
}

/**
 * Set a photo as the primary photo.
 * Unsets primary on all other photos and sets it on the target photo.
 */
export async function setPrimaryPhoto(
  userId: string,
  data: SetPrimaryPhotoInput,
): Promise<void> {
  // 1. Find profile by userId
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  if (!profile) {
    throw Object.assign(new Error('Profile not found'), { name: 'PROFILE_NOT_FOUND' });
  }

  // 2. Verify photo ownership
  const [photo] = await db
    .select()
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.id, data.photoId),
        eq(profilePhotos.profileId, profile.id),
      ),
    );

  if (!photo) {
    throw Object.assign(new Error('Photo not found'), { name: 'PHOTO_NOT_FOUND' });
  }

  // 3. In a transaction: unset all, then set target
  await db.transaction(async (tx) => {
    await tx
      .update(profilePhotos)
      .set({ isPrimary: false })
      .where(eq(profilePhotos.profileId, profile.id));

    await tx
      .update(profilePhotos)
      .set({ isPrimary: true })
      .where(eq(profilePhotos.id, data.photoId));
  });
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Recalculate profile completeness score based on profileSections.
 * Score = sum of weights for true sections.
 */
async function recalculateScore(profileId: string): Promise<void> {
  // 1. Fetch profileSections row
  const [sectionsRow] = await db
    .select()
    .from(profileSections)
    .where(eq(profileSections.profileId, profileId));

  // 2. Calculate score
  let score = 0;
  if (!sectionsRow) {
    score = 0;
  } else {
    if (sectionsRow.personal)    score += SECTION_WEIGHTS.personal;
    if (sectionsRow.family)      score += SECTION_WEIGHTS.family;
    if (sectionsRow.career)      score += SECTION_WEIGHTS.career;
    if (sectionsRow.lifestyle)   score += SECTION_WEIGHTS.lifestyle;
    if (sectionsRow.horoscope)   score += SECTION_WEIGHTS.horoscope;
    if (sectionsRow.photos)      score += SECTION_WEIGHTS.photos;
    if (sectionsRow.preferences) score += SECTION_WEIGHTS.preferences;
  }

  // 3. Update profiles table
  await db
    .update(profiles)
    .set({ profileCompleteness: score, updatedAt: new Date() })
    .where(eq(profiles.id, profileId));
}
