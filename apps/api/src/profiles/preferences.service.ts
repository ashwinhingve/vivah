// apps/api/src/profiles/preferences.service.ts

import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';
import type { PartnerPreferencesSection } from '@smartshaadi/types';
import type { UpdatePartnerPreferencesInput } from '@smartshaadi/schemas';

type MongoDoc = { userId: string; [key: string]: unknown };

export async function updatePartnerPreferences(
  userId: string,
  data: UpdatePartnerPreferencesInput,
): Promise<PartnerPreferencesSection> {
  const model = ProfileContent as unknown as Model<MongoDoc>;
  // Use dot-notation $set to avoid overwriting entire partnerPreferences subdoc
  const setFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val != null) setFields[`partnerPreferences.${key}`] = val;
  }
  const doc = await model.findOneAndUpdate(
    { userId },
    { $set: setFields },
    { new: true, upsert: true, lean: true },
  ) as MongoDoc | null;
  const prefs = doc?.partnerPreferences as PartnerPreferencesSection | undefined;
  return prefs ?? {};
}

export async function getPartnerPreferences(
  userId: string,
): Promise<PartnerPreferencesSection | null> {
  const model = ProfileContent as unknown as Model<MongoDoc>;
  const doc = await model
    .findOne({ userId }, { partnerPreferences: 1 })
    .lean() as MongoDoc | null;
  return doc ? (doc.partnerPreferences as PartnerPreferencesSection) : null;
}
