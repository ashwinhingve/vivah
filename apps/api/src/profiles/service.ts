import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, profilePhotos, profileSections, user } from '@smartshaadi/db';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';
import { getPhotoUrls } from '../storage/service.js';
import type {
  ProfileDetailResponse,
  PersonalSection,
  EducationSection,
  ProfessionSection,
  FamilySection,
  LocationSection,
  LifestyleSection,
  HoroscopeSection,
  PartnerPreferencesSection,
} from '@smartshaadi/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileResponse {
  id:                   string;
  userId:               string;
  name:                 string;
  role:                 string;
  status:               string;
  // Contact — only exposed when isSelf (no safety_mode_unlocks table yet; always masked for others)
  phoneNumber:          string | null;
  email:                string | null;
  verificationStatus:   string;
  premiumTier:          string;
  profileCompleteness:  number;
  isActive:             boolean;
  stayQuotient:         string | null;
  familyInclinationScore:  number | null;
  functionAttendanceScore: number | null;
  photos:               { id: string; r2Key: string; isPrimary: boolean; displayOrder: number }[];
  createdAt:            Date;
  updatedAt:            Date;
}

export interface UpdateProfileInput {
  stayQuotient?:           'INDEPENDENT' | 'WITH_PARENTS' | 'WITH_INLAWS' | 'FLEXIBLE';
  familyInclinationScore?: number;
  functionAttendanceScore?: number;
  isActive?:               boolean;
}

export interface AddPhotoInput {
  r2Key:         string;
  isPrimary?:    boolean;
  displayOrder?: number;
}

export interface PhotoResponse {
  id:           string;
  r2Key:        string;
  isPrimary:    boolean;
  displayOrder: number;
  uploadedAt:   Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateCompleteness(input: UpdateProfileInput): number {
  let filled = 0;
  const total = 3;
  if (input.stayQuotient           != null) filled++;
  if (input.familyInclinationScore != null) filled++;
  if (input.functionAttendanceScore != null) filled++;
  return Math.round((filled / total) * 100);
}

function buildProfileResponse(
  profile: typeof profiles.$inferSelect,
  userRow: typeof user.$inferSelect,
  photos: (typeof profilePhotos.$inferSelect)[],
  isSelf: boolean,
): ProfileResponse {
  return {
    id:                      profile.id,
    userId:                  profile.userId,
    name:                    userRow.name,
    role:                    userRow.role,
    status:                  userRow.status,
    // Contact masked unless viewing own profile
    // TODO: expose when safety_mode_unlocks is implemented in schema
    phoneNumber:             isSelf ? (userRow.phoneNumber ?? null) : null,
    email:                   isSelf ? (userRow.email ?? null) : null,
    verificationStatus:      profile.verificationStatus,
    premiumTier:             profile.premiumTier,
    profileCompleteness:     profile.profileCompleteness ?? 0,
    isActive:                profile.isActive,
    stayQuotient:            profile.stayQuotient ?? null,
    familyInclinationScore:  profile.familyInclinationScore ?? null,
    functionAttendanceScore: profile.functionAttendanceScore ?? null,
    photos:                  photos.map(p => ({
      id:           p.id,
      r2Key:        p.r2Key,
      isPrimary:    p.isPrimary,
      displayOrder: p.displayOrder,
    })),
    createdAt:  profile.createdAt,
    updatedAt:  profile.updatedAt,
  };
}

// ── Service functions ─────────────────────────────────────────────────────────

/** Fetch the authenticated user's own profile. Creates a profile row if none exists. */
export async function getMyProfile(userId: string): Promise<ProfileResponse | null> {
  const [userRow] = await db.select().from(user).where(eq(user.id, userId));
  if (!userRow) return null;

  let [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));

  // Auto-create profile row on first access
  if (!profile) {
    const rows = await db
      .insert(profiles)
      .values({ userId, verificationStatus: 'PENDING', premiumTier: 'FREE', isActive: true })
      .returning();
    profile = rows[0];
    if (!profile) return null;
  }

  const photos = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profile.id));

  return buildProfileResponse(profile, userRow, photos, true);
}

/** Update mutable fields on the authenticated user's profile. */
export async function updateMyProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileResponse | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) return null;

  const resolvedStay = (input.stayQuotient ?? profile.stayQuotient) as UpdateProfileInput['stayQuotient'];
  const resolvedFamily   = input.familyInclinationScore  ?? profile.familyInclinationScore  ?? undefined;
  const resolvedFunction = input.functionAttendanceScore ?? profile.functionAttendanceScore ?? undefined;
  const completenessInput: UpdateProfileInput = {};
  if (resolvedStay    != null) completenessInput.stayQuotient            = resolvedStay;
  if (resolvedFamily  != null) completenessInput.familyInclinationScore  = resolvedFamily;
  if (resolvedFunction != null) completenessInput.functionAttendanceScore = resolvedFunction;
  const completeness = calculateCompleteness(completenessInput);

  const [updated] = await db
    .update(profiles)
    .set({
      ...(input.stayQuotient            != null && { stayQuotient: input.stayQuotient }),
      ...(input.familyInclinationScore  != null && { familyInclinationScore: input.familyInclinationScore }),
      ...(input.functionAttendanceScore != null && { functionAttendanceScore: input.functionAttendanceScore }),
      ...(input.isActive                != null && { isActive: input.isActive }),
      profileCompleteness: completeness,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) return null;

  const [userRow] = await db.select().from(user).where(eq(user.id, userId));
  if (!userRow) return null;

  const photos = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, updated.id));

  return buildProfileResponse(updated, userRow, photos, true);
}

/** Add a photo record after the file has been uploaded to R2 via pre-signed URL. */
export async function addProfilePhoto(
  userId: string,
  input: AddPhotoInput,
): Promise<PhotoResponse | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) return null;

  const isPrimary    = input.isPrimary    ?? false;
  const displayOrder = input.displayOrder ?? 0;

  const rows = await db
    .insert(profilePhotos)
    .values({ profileId: profile.id, r2Key: input.r2Key, isPrimary, displayOrder })
    .returning();
  const photo = rows[0];
  if (!photo) return null;

  return {
    id:           photo.id,
    r2Key:        photo.r2Key,
    isPrimary:    photo.isPrimary,
    displayOrder: photo.displayOrder,
    uploadedAt:   photo.uploadedAt,
  };
}

/** Delete a photo record by photo UUID, verifying it belongs to this user's profile. */
export async function deleteProfilePhoto(
  userId: string,
  photoId: string,
): Promise<boolean> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) return false;

  const { rowCount } = await db
    .delete(profilePhotos)
    .where(and(eq(profilePhotos.id, photoId), eq(profilePhotos.profileId, profile.id)));

  return (rowCount ?? 0) > 0;
}

/** Fetch another user's profile by profile UUID. Enriched with MongoDB content + presigned photo URLs. */
export async function getProfileById(
  profileId: string,
  requestingUserId: string,
): Promise<ProfileDetailResponse | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile || !profile.isActive) return null;

  const [userRow] = await db.select().from(user).where(eq(user.id, profile.userId));
  if (!userRow) return null;

  const isSelf = profile.userId === requestingUserId;

  const photoRows = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profile.id));

  // Generate presigned GET URLs for all photos
  const urls = await getPhotoUrls(photoRows.map(p => p.r2Key));
  const photosWithUrls = photoRows.map((p, i) => ({
    id:           p.id,
    r2Key:        p.r2Key,
    isPrimary:    p.isPrimary,
    displayOrder: p.displayOrder,
    ...(urls[i] != null ? { url: urls[i] as string } : {}),
  }));

  // Fetch MongoDB content
  type MongoDoc = { userId: string; [key: string]: unknown };
  const contentModel = ProfileContent as unknown as Model<MongoDoc>;
  const contentDoc = await contentModel.findOne({ userId: profile.userId }).lean() as MongoDoc | null;

  // Safety mode: mask contact if enabled and viewer is not owner
  let phoneNumber: string | null = isSelf ? (userRow.phoneNumber ?? null) : null;
  let email: string | null = isSelf ? (userRow.email ?? null) : null;
  if (!isSelf && contentDoc) {
    const safetyMode = contentDoc.safetyMode as { contactHidden?: boolean } | undefined;
    if (safetyMode?.contactHidden === true) {
      phoneNumber = null;
      email = null;
    }
  }

  // Fetch profileSections row to populate sectionCompletion
  const [sectionsRow] = await db
    .select()
    .from(profileSections)
    .where(eq(profileSections.profileId, profile.id));

  const base = buildProfileResponse(profile, userRow, photoRows, isSelf);

  return {
    ...base,
    phoneNumber,
    email,
    photos: photosWithUrls,
    ...(contentDoc?.personal    != null && { personal:           contentDoc.personal    as PersonalSection }),
    ...(contentDoc?.education   != null && { education:          contentDoc.education   as EducationSection }),
    ...(contentDoc?.profession  != null && { profession:         contentDoc.profession  as ProfessionSection }),
    ...(contentDoc?.family      != null && { family:             contentDoc.family      as FamilySection }),
    ...(contentDoc?.location    != null && { location:           contentDoc.location    as LocationSection }),
    ...(contentDoc?.lifestyle   != null && { lifestyle:          contentDoc.lifestyle   as LifestyleSection }),
    ...(contentDoc?.horoscope   != null && { horoscope:          contentDoc.horoscope   as HoroscopeSection }),
    ...(contentDoc?.partnerPreferences != null && { partnerPreferences: contentDoc.partnerPreferences as PartnerPreferencesSection }),
    ...(typeof contentDoc?.aboutMe === 'string' && { aboutMe: contentDoc.aboutMe }),
    ...(sectionsRow != null && {
      sectionCompletion: {
        personal:    sectionsRow.personal,
        family:      sectionsRow.family,
        career:      sectionsRow.career,
        lifestyle:   sectionsRow.lifestyle,
        horoscope:   sectionsRow.horoscope,
        photos:      sectionsRow.photos,
        preferences: sectionsRow.preferences,
        score:       profile.profileCompleteness ?? 0,
      },
    }),
  };
}
