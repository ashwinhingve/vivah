import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, profilePhotos, user } from '@smartshaadi/db';

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

/** Fetch another user's profile by profile UUID. Masks contact details (not self). */
export async function getProfileById(
  profileId: string,
  requestingUserId: string,
): Promise<ProfileResponse | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile || !profile.isActive) return null;

  const [userRow] = await db.select().from(user).where(eq(user.id, profile.userId));
  if (!userRow) return null;

  const isSelf = profile.userId === requestingUserId;

  const photos = await db
    .select()
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profile.id));

  return buildProfileResponse(profile, userRow, photos, isSelf);
}
