import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import { profiles, profilePhotos, profileSections, communityZones, user } from '@smartshaadi/db';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';
import { getPhotoUrls } from '../storage/service.js';
import { computeAndUpdateCompleteness } from './content.service.js';
import { geocode } from '../lib/geocode.js';
import type { PersonalityProfile } from '@smartshaadi/types';
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
  ProfileSectionCompletion,
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
  lastActiveAt?:        string | null;
  audioIntroKey?:       string | null;
  videoIntroKey?:       string | null;
  sectionCompletion?:   ProfileSectionCompletion;
  personal?:            PersonalSection;
  education?:           EducationSection;
  profession?:          ProfessionSection;
  family?:              FamilySection;
  location?:            LocationSection;
  lifestyle?:           LifestyleSection;
  horoscope?:           HoroscopeSection;
  partnerPreferences?:  PartnerPreferencesSection;
  aboutMe?:             string;
  community?:           string | null;
  subCommunity?:        string | null;
  motherTongue?:        string | null;
  preferredLang?:       string | null;
  lgbtqProfile?:        boolean | null;
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
    // Contact masked unless viewing own profile. Other viewers must call
    // GET /api/v1/profiles/:targetUserId/contact (gated by getContactIfVisible)
    // which checks accepted match + safetyMode.contactHidden + safetyModeUnlocks.
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
    lastActiveAt: profile.lastActiveAt ? profile.lastActiveAt.toISOString() : null,
    audioIntroKey: profile.audioIntroKey ?? null,
    videoIntroKey: profile.videoIntroKey ?? null,
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

  // Compute fresh completeness — writes to profileSections + profiles.profileCompleteness
  const completeness = await computeAndUpdateCompleteness(userId);
  profile.profileCompleteness = completeness;

  // Fetch updated profileSections row
  const [sectionsRow] = await db
    .select()
    .from(profileSections)
    .where(eq(profileSections.profileId, profile.id));

  // Fetch community zone data (SQL-only, not in MongoDB)
  const [communityRow] = await db
    .select()
    .from(communityZones)
    .where(eq(communityZones.profileId, profile.id));

  // Fetch MongoDB content (or mock store in dev)
  type MongoDoc = { userId: string; [key: string]: unknown };
  let contentDoc: MongoDoc | null;
  if (env.USE_MOCK_SERVICES) {
    contentDoc = mockGet(profile.userId) as MongoDoc | null;
  } else {
    const contentModel = ProfileContent as unknown as Model<MongoDoc>;
    contentDoc = await contentModel.findOne({ userId: profile.userId }).lean() as MongoDoc | null;
  }

  const base = buildProfileResponse(profile, userRow, photos, true);

  return {
    ...base,
    ...(contentDoc?.personal           != null && { personal:           contentDoc.personal           as PersonalSection }),
    ...(contentDoc?.education          != null && { education:          contentDoc.education          as EducationSection }),
    ...(contentDoc?.profession         != null && { profession:         contentDoc.profession         as ProfessionSection }),
    ...(contentDoc?.family             != null && { family:             contentDoc.family             as FamilySection }),
    ...(contentDoc?.location           != null && { location:           contentDoc.location           as LocationSection }),
    ...(contentDoc?.lifestyle          != null && { lifestyle:          contentDoc.lifestyle          as LifestyleSection }),
    ...(contentDoc?.horoscope          != null && { horoscope:          contentDoc.horoscope          as HoroscopeSection }),
    ...(contentDoc?.partnerPreferences != null && { partnerPreferences: contentDoc.partnerPreferences as PartnerPreferencesSection }),
    ...(typeof contentDoc?.aboutMe === 'string' && { aboutMe: contentDoc.aboutMe }),
    ...(communityRow != null && {
      community:     communityRow.community,
      subCommunity:  communityRow.subCommunity,
      motherTongue:  communityRow.motherTongue,
      preferredLang: communityRow.preferredLang,
      lgbtqProfile:  communityRow.lgbtqProfile,
    }),
    ...(sectionsRow != null && {
      sectionCompletion: {
        personal:    sectionsRow.personal,
        family:      sectionsRow.family,
        career:      sectionsRow.career,
        lifestyle:   sectionsRow.lifestyle,
        horoscope:   sectionsRow.horoscope,
        photos:      sectionsRow.photos,
        preferences: sectionsRow.preferences,
        personality: sectionsRow.personality,
        score:       completeness,
      },
    }),
  };
}

/** Update mutable fields on the authenticated user's profile. */
export async function updateMyProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileResponse | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) return null;

  const [updated] = await db
    .update(profiles)
    .set({
      ...(input.stayQuotient            != null && { stayQuotient: input.stayQuotient }),
      ...(input.familyInclinationScore  != null && { familyInclinationScore: input.familyInclinationScore }),
      ...(input.functionAttendanceScore != null && { functionAttendanceScore: input.functionAttendanceScore }),
      ...(input.isActive                != null && { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  // Recompute completeness from all MongoDB sections + photos (authoritative scoring)
  const completeness = await computeAndUpdateCompleteness(userId);
  if (updated) updated.profileCompleteness = completeness;

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

  // Fetch MongoDB content (or mock store in dev)
  type MongoDoc = { userId: string; [key: string]: unknown };
  let contentDoc: MongoDoc | null;
  if (env.USE_MOCK_SERVICES) {
    contentDoc = mockGet(profile.userId) as MongoDoc | null;
  } else {
    const contentModel = ProfileContent as unknown as Model<MongoDoc>;
    contentDoc = await contentModel.findOne({ userId: profile.userId }).lean() as MongoDoc | null;
  }

  // Privacy: phone/email always masked for non-self viewers. To retrieve contact,
  // the viewer must call GET /api/v1/profiles/:targetUserId/contact which requires
  // an ACCEPTED match (see safety.service.ts:getContactIfVisible).
  const phoneNumber: string | null = isSelf ? (userRow.phoneNumber ?? null) : null;
  const email: string | null = isSelf ? (userRow.email ?? null) : null;

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
        personality: sectionsRow.personality,
        score:       profile.profileCompleteness ?? 0,
      },
    }),
  };
}

export async function savePersonality(
  userId: string,
  personality: PersonalityProfile,
): Promise<void> {
  if (env.USE_MOCK_SERVICES) {
    mockUpsertField(userId, "personality", personality);
    return;
  }
  const model = ProfileContent as unknown as Model<unknown>;
  await model.updateOne(
    { userId },
    { $set: { personality } },
    { upsert: true },
  );
}

export async function geocodeAndPersistCoords(
  userId: string,
  city: string | null | undefined,
  state: string | null | undefined,
): Promise<void> {
  if (!city || !state) return;
  const coords = await geocode(city, state);
  if (!coords) return;
  await db
    .update(profiles)
    .set({ latitude: String(coords.lat), longitude: String(coords.lng) })
    .where(eq(profiles.userId, userId));
}
