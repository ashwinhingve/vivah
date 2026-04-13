// apps/api/src/profiles/content.service.ts

import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
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
} from '@smartshaadi/types';
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
  return upsertSection(userId, 'location', data);
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
