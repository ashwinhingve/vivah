// apps/api/src/profiles/preferences.service.ts

import { env } from '../lib/env.js';
import { mockUpsertDotFields, mockGet } from '../lib/mockStore.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';
import type { PartnerPreferencesSection } from '@smartshaadi/types';
import type { UpdatePartnerPreferencesInput } from '@smartshaadi/schemas';

type MongoDoc = { userId: string; [key: string]: unknown };

export async function updatePartnerPreferences(
  userId: string,
  data: UpdatePartnerPreferencesInput,
): Promise<PartnerPreferencesSection> {
  const setFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val != null) setFields[`partnerPreferences.${key}`] = val;
  }

  if (env.USE_MOCK_SERVICES) {
    const doc = mockUpsertDotFields(userId, setFields);
    return (doc['partnerPreferences'] as PartnerPreferencesSection) ?? {};
  }

  const model = ProfileContent as unknown as Model<MongoDoc>;
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
  if (env.USE_MOCK_SERVICES) {
    const doc = mockGet(userId);
    return doc ? (doc['partnerPreferences'] as PartnerPreferencesSection) : null;
  }
  const model = ProfileContent as unknown as Model<MongoDoc>;
  const doc = await model
    .findOne({ userId }, { partnerPreferences: 1 })
    .lean() as MongoDoc | null;
  return doc ? (doc.partnerPreferences as PartnerPreferencesSection) : null;
}
