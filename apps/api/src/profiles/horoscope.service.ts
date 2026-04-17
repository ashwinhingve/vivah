// apps/api/src/profiles/horoscope.service.ts

import { env } from '../lib/env.js';
import { mockUpsertDotFields, mockGet } from '../lib/mockStore.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';
import type { HoroscopeSection, ProfileContentResponse } from '@smartshaadi/types';
import type { UpdateHoroscopeInput } from '@smartshaadi/schemas';

type MongoDoc = { userId: string; [key: string]: unknown };

export async function updateHoroscope(
  userId: string,
  data: UpdateHoroscopeInput,
): Promise<ProfileContentResponse> {
  const setFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val != null) setFields[`horoscope.${key}`] = val;
  }

  if (env.USE_MOCK_SERVICES) {
    return mockUpsertDotFields(userId, setFields) as unknown as ProfileContentResponse;
  }

  const model = ProfileContent as unknown as Model<MongoDoc>;
  const doc = await model.findOneAndUpdate(
    { userId },
    { $set: setFields },
    { new: true, upsert: true, lean: true },
  );
  return doc as unknown as ProfileContentResponse;
}

export async function getHoroscope(userId: string): Promise<HoroscopeSection | null> {
  if (env.USE_MOCK_SERVICES) {
    const doc = mockGet(userId);
    return doc ? (doc['horoscope'] as HoroscopeSection) : null;
  }
  const model = ProfileContent as unknown as Model<MongoDoc>;
  const doc = (await model.findOne({ userId }, { horoscope: 1 }).lean()) as MongoDoc | null;
  return doc ? (doc.horoscope as HoroscopeSection) : null;
}
