// apps/api/src/profiles/content.service.ts

import { env } from '../lib/env.js';
import { mockUpsertField, mockGet } from '../lib/mockStore.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import { db } from '../lib/db.js';

function mockUpsert(userId: string, section: string, data: object): Record<string, unknown> {
  return mockUpsertField(userId, section, data);
}
import { profiles, profilePhotos, profileSections } from '@smartshaadi/db';
import { eq, count } from 'drizzle-orm';
import type {
  ProfileContentResponse,
  PersonalSection,
  EducationSection,
  ProfessionSection,
  FamilySection,
  LocationSection,
  LifestyleSection,
  HoroscopeSection,
  PartnerPreferencesSection,
  SiblingEntry,
  AdditionalDegreeEntry,
} from '@smartshaadi/types';
import type { ProfileBulkUpdateInput } from '@smartshaadi/schemas';
import type { Model } from 'mongoose';

// All mutable section keys in the ProfileContent document
type ContentSection =
  | 'personal'
  | 'education'
  | 'profession'
  | 'family'
  | 'location'
  | 'lifestyle'
  | 'horoscope'
  | 'partnerPreferences';

/**
 * Upsert a named section on the ProfileContent document.
 * Creates the document if it doesn't exist yet (upsert: true).
 */
async function upsertSection(
  userId: string,
  section: ContentSection,
  data: object,
): Promise<ProfileContentResponse> {
  if (env.USE_MOCK_SERVICES) {
    return mockUpsert(userId, section, data) as unknown as ProfileContentResponse;
  }
  const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
  const doc = await model.findOneAndUpdate(
    { userId },
    { $set: { [section]: data } },
    { new: true, upsert: true, lean: true },
  );
  // lean() returns a plain JS object; cast to our response type
  return doc as unknown as ProfileContentResponse;
}

/** Fetch the full ProfileContent document for a user. Returns null if not yet created. */
export async function getMyProfileContent(
  userId: string,
): Promise<ProfileContentResponse | null> {
  if (env.USE_MOCK_SERVICES) {
    return mockGet(userId) as unknown as ProfileContentResponse | null;
  }
  const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
  const doc = await model.findOne({ userId }).lean();
  return doc ? (doc as unknown as ProfileContentResponse) : null;
}

export async function updatePersonal(
  userId: string,
  data: PersonalSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'personal', data);
}

export async function updateEducation(
  userId: string,
  data: EducationSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'education', data);
}

export async function updateProfession(
  userId: string,
  data: ProfessionSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'profession', data);
}

export async function updateFamily(
  userId: string,
  data: FamilySection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'family', data);
}

export async function updateLocation(
  userId: string,
  data: LocationSection,
): Promise<ProfileContentResponse> {
  const result = await upsertSection(userId, 'location', data);
  // Geocode + persist coords as a fire-and-forget side-effect; coord absence
  // falls back to city/state in the engine, so this never blocks the response.
  void (async () => {
    try {
      const { geocodeAndPersistCoords } = await import('./service.js');
      await geocodeAndPersistCoords(userId, data.city ?? null, data.state ?? null);
    } catch (e) {
      console.error('Geocode persist failed:', e);
    }
  })();
  return result;
}

export async function updateLifestyle(
  userId: string,
  data: LifestyleSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'lifestyle', data);
}

export async function updateHoroscope(
  userId: string,
  data: HoroscopeSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'horoscope', data);
}

export async function updatePartnerPreferences(
  userId: string,
  data: PartnerPreferencesSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'partnerPreferences', data);
}

export async function updateAboutMe(
  userId: string,
  aboutMe: string,
): Promise<ProfileContentResponse> {
  if (env.USE_MOCK_SERVICES) {
    return mockUpsertField(userId, 'aboutMe', aboutMe) as unknown as ProfileContentResponse;
  }
  const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
  const doc = await model.findOneAndUpdate(
    { userId },
    { $set: { aboutMe } },
    { new: true, upsert: true, lean: true },
  );
  return doc as unknown as ProfileContentResponse;
}

/**
 * Compute profile completeness by analyzing MongoDB ProfileContent document
 * and updating both profileSections (PostgreSQL) and profiles.profileCompleteness.
 * Returns the computed score (0–100).
 */
export async function computeAndUpdateCompleteness(userId: string): Promise<number> {
  // 1. Fetch ProfileContent (mock store or MongoDB)
  let doc: Record<string, unknown> | null;
  if (env.USE_MOCK_SERVICES) {
    doc = mockGet(userId);
  } else {
    const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
    doc = await model.findOne({ userId }).lean() as Record<string, unknown> | null;
  }

  // 2. Determine section completion (minimum-field heuristics)
  const personal =
    doc != null &&
    (doc.personal as Record<string, unknown> | undefined)?.fullName != null &&
    (doc.personal as Record<string, unknown> | undefined)?.dob != null &&
    (doc.personal as Record<string, unknown> | undefined)?.gender != null;

  const familyDoc = doc?.family as Record<string, unknown> | undefined;
  const family = familyDoc?.familyType != null;

  const educationDoc = doc?.education as Record<string, unknown> | undefined;
  const professionDoc = doc?.profession as Record<string, unknown> | undefined;
  const career = educationDoc?.degree != null && professionDoc?.occupation != null;

  const lifestyleDoc = doc?.lifestyle as Record<string, unknown> | undefined;
  const lifestyle =
    lifestyleDoc?.diet != null &&
    lifestyleDoc?.smoking != null &&
    lifestyleDoc?.drinking != null;

  const horoscopeDoc = doc?.horoscope as Record<string, unknown> | undefined;
  const horoscope =
    horoscopeDoc?.rashi != null ||
    horoscopeDoc?.nakshatra != null;

  const preferences =
    (doc?.partnerPreferences as Record<string, unknown> | undefined)?.ageRange != null;

  // 3. Get the profileId (uuid) from the profiles table — needed for photos count + upsert
  const profileRows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (profileRows.length === 0) return 0;
  const profileId = profileRows[0]!.id;

  // Count actual uploaded photos for this profile
  const [photoCountRow] = await db
    .select({ value: count() })
    .from(profilePhotos)
    .where(eq(profilePhotos.profileId, profileId));
  const photos = (photoCountRow?.value ?? 0) > 0;

  await db
    .insert(profileSections)
    .values({
      profileId,
      personal,
      family,
      career,
      lifestyle,
      horoscope,
      photos,
      preferences,
    })
    .onConflictDoUpdate({
      target: profileSections.profileId,
      set: {
        personal,
        family,
        career,
        lifestyle,
        horoscope,
        photos,
        preferences,
        updatedAt: new Date(),
      },
    });

  // 4. Compute weighted score
  // personal=20, photos=20, family=15, career=15, lifestyle=10, horoscope=10, preferences=10
  const score =
    (personal ? 20 : 0) +
    (photos ? 20 : 0) +
    (family ? 15 : 0) +
    (career ? 15 : 0) +
    (lifestyle ? 10 : 0) +
    (horoscope ? 10 : 0) +
    (preferences ? 10 : 0);

  // 5. Update profiles.profileCompleteness
  await db
    .update(profiles)
    .set({ profileCompleteness: score })
    .where(eq(profiles.id, profileId));

  return score;
}

/**
 * Bulk update multiple content sections and recompute profile completeness.
 * Returns the full ProfileContent response with computed completenessScore.
 */
export async function bulkUpdateContent(
  userId: string,
  data: ProfileBulkUpdateInput,
): Promise<ProfileContentResponse & { completenessScore: number }> {
  let content: ProfileContentResponse | null = null;

  if (data.family != null) {
    const familyInput: Partial<FamilySection> = {};
    if (data.family.fatherName != null) familyInput.fatherName = data.family.fatherName;
    if (data.family.fatherOccupation != null)
      familyInput.fatherOccupation = data.family.fatherOccupation;
    if (data.family.motherName != null) familyInput.motherName = data.family.motherName;
    if (data.family.motherOccupation != null)
      familyInput.motherOccupation = data.family.motherOccupation;
    if (data.family.siblings != null) {
      familyInput.siblings = data.family.siblings.map(s => {
        const entry: SiblingEntry = {};
        if (s.name !== undefined) entry.name = s.name;
        if (s.married !== undefined) entry.married = s.married;
        if (s.occupation !== undefined) entry.occupation = s.occupation;
        return entry;
      });
    }
    if (data.family.familyType != null) familyInput.familyType = data.family.familyType;
    if (data.family.familyValues != null) familyInput.familyValues = data.family.familyValues;
    if (data.family.familyStatus != null) familyInput.familyStatus = data.family.familyStatus;
    if (data.family.nativePlace != null) familyInput.nativePlace = data.family.nativePlace;
    if (data.family.familyAbout != null) familyInput.familyAbout = data.family.familyAbout;
    content = await updateFamily(userId, familyInput as FamilySection);
  }

  if (data.education != null) {
    const eduInput: Partial<EducationSection> = {};
    if (data.education.degree != null) eduInput.degree = data.education.degree;
    if (data.education.college != null) eduInput.college = data.education.college;
    if (data.education.fieldOfStudy != null)
      eduInput.fieldOfStudy = data.education.fieldOfStudy;
    if (data.education.year != null) eduInput.year = data.education.year;
    if (data.education.additionalDegrees != null) {
      eduInput.additionalDegrees = data.education.additionalDegrees.map(d => {
        const entry: AdditionalDegreeEntry = {};
        if (d.degree !== undefined) entry.degree = d.degree;
        if (d.college !== undefined) entry.college = d.college;
        if (d.year !== undefined) entry.year = d.year;
        return entry;
      });
    }
    content = await updateEducation(userId, eduInput as EducationSection);
  }

  if (data.profession != null) {
    const profInput: Partial<ProfessionSection> = {};
    if (data.profession.occupation != null) profInput.occupation = data.profession.occupation;
    if (data.profession.employer != null) profInput.employer = data.profession.employer;
    if (data.profession.incomeRange != null) profInput.incomeRange = data.profession.incomeRange;
    if (data.profession.workLocation != null)
      profInput.workLocation = data.profession.workLocation;
    if (data.profession.workingAbroad != null)
      profInput.workingAbroad = data.profession.workingAbroad;
    if (data.profession.employerType != null)
      profInput.employerType = data.profession.employerType;
    if (data.profession.designation != null) profInput.designation = data.profession.designation;
    if (data.profession.abroadCountry != null)
      profInput.abroadCountry = data.profession.abroadCountry;
    content = await updateProfession(userId, profInput as ProfessionSection);
  }

  if (data.lifestyle != null) {
    const lifeInput: Partial<LifestyleSection> = {};
    if (data.lifestyle.diet != null) lifeInput.diet = data.lifestyle.diet;
    if (data.lifestyle.smoking != null) lifeInput.smoking = data.lifestyle.smoking;
    if (data.lifestyle.drinking != null) lifeInput.drinking = data.lifestyle.drinking;
    if (data.lifestyle.hobbies != null) lifeInput.hobbies = data.lifestyle.hobbies;
    if (data.lifestyle.interests != null) lifeInput.interests = data.lifestyle.interests;
    if (data.lifestyle.hyperNicheTags != null)
      lifeInput.hyperNicheTags = [...data.lifestyle.hyperNicheTags];
    if (data.lifestyle.languagesSpoken != null)
      lifeInput.languagesSpoken = data.lifestyle.languagesSpoken;
    if (data.lifestyle.ownHouse != null) lifeInput.ownHouse = data.lifestyle.ownHouse;
    if (data.lifestyle.ownCar != null) lifeInput.ownCar = data.lifestyle.ownCar;
    if (data.lifestyle.fitnessLevel != null) lifeInput.fitnessLevel = data.lifestyle.fitnessLevel;
    if (data.lifestyle.sunSign != null) lifeInput.sunSign = data.lifestyle.sunSign;
    content = await updateLifestyle(userId, lifeInput as LifestyleSection);
  }

  if (content == null) {
    content = await getMyProfileContent(userId);
  }

  const completenessScore = await computeAndUpdateCompleteness(userId);

  return {
    ...(content as ProfileContentResponse),
    completenessScore,
  };
}
