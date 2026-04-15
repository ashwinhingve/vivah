// apps/api/src/profiles/horoscope.service.ts

import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';
import type { HoroscopeSection, ProfileContentResponse } from '@smartshaadi/types';
import type { UpdateHoroscopeInput } from '@smartshaadi/schemas';

type MongoDoc = { userId: string; [key: string]: unknown };

/**
 * Update horoscope data using dot-notation $set to avoid overwriting
 * the full horoscope subdocument.
 */
export async function updateHoroscope(
  userId: string,
  data: UpdateHoroscopeInput,
): Promise<ProfileContentResponse> {
  const model = ProfileContent as unknown as Model<MongoDoc>;
  // Use dot-notation $set to avoid overwriting the full horoscope subdoc
  const setFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val != null) setFields[`horoscope.${key}`] = val;
  }
  const doc = await model.findOneAndUpdate(
    { userId },
    { $set: setFields },
    { new: true, upsert: true, lean: true },
  );
  return doc as unknown as ProfileContentResponse;
}

/**
 * Get horoscope data for a user.
 */
export async function getHoroscope(userId: string): Promise<HoroscopeSection | null> {
  const model = ProfileContent as unknown as Model<MongoDoc>;
  const doc = (await model.findOne({ userId }, { horoscope: 1 }).lean()) as MongoDoc | null;
  return doc ? (doc.horoscope as HoroscopeSection) : null;
}
