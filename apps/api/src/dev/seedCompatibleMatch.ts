import { eq } from 'drizzle-orm';
import { user, profiles } from '@smartshaadi/db';
import type { Model } from 'mongoose';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import { computeAndCacheFeed } from '../matchmaking/engine.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';

const FIXED_ID    = 'seed-compatible-001';
const FIXED_PHONE = '+919999999002';
const FIXED_EMAIL = 'compatible@dev.smartshaadi.co.in';

function oppositeGender(g: string | undefined): 'MALE' | 'FEMALE' {
  return g === 'FEMALE' ? 'MALE' : 'FEMALE';
}

function dobFromAge(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth((d.getMonth() + 3) % 12);
  return d;
}

function currentAge(content: Record<string, unknown> | null): number {
  const personal = content?.['personal'] as { dob?: string | Date } | undefined;
  const dob = personal?.dob ? new Date(personal.dob) : null;
  if (!dob || Number.isNaN(dob.getTime())) return 28;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function currentLocation(content: Record<string, unknown> | null): { city: string; state: string } {
  const loc = content?.['location'] as { city?: string; state?: string } | undefined;
  return { city: loc?.city ?? 'Mumbai', state: loc?.state ?? 'Maharashtra' };
}

function currentReligion(content: Record<string, unknown> | null): string {
  const personal = content?.['personal'] as { religion?: string } | undefined;
  return personal?.religion ?? 'Hindu';
}

/**
 * Idempotent — re-running just refreshes the fixed seed user's content and
 * relaxes the caller's prefs again.
 */
export async function seedCompatibleMatch(currentUserId: string): Promise<{
  matchCreated: true;
  matchUserId:  string;
  reused:       boolean;
}> {
  const currentContent  = mockGet(currentUserId);
  const currentPersonal = currentContent?.['personal'] as { gender?: string } | undefined;
  const myGender        = currentPersonal?.gender ?? 'MALE';
  const targetGender    = oppositeGender(myGender);
  const myAge           = currentAge(currentContent);
  const { city, state } = currentLocation(currentContent);
  const religion        = currentReligion(currentContent);
  const matchAge        = myAge + (targetGender === 'FEMALE' ? -2 : 2);
  const matchName       = targetGender === 'FEMALE' ? 'Priya Compatible' : 'Arjun Compatible';

  // 1. Postgres user row — upsert by id, tolerate phone/email collisions from earlier runs
  const existingById = await db.select().from(user).where(eq(user.id, FIXED_ID)).limit(1);
  const reused = existingById.length > 0;

  if (!reused) {
    await db.insert(user).values({
      id:                   FIXED_ID,
      name:                 matchName,
      email:                FIXED_EMAIL,
      emailVerified:        true,
      phoneNumber:          FIXED_PHONE,
      phoneNumberVerified:  true,
      role:                 'INDIVIDUAL',
      status:               'ACTIVE',
      createdAt:            new Date(),
      updatedAt:            new Date(),
    }).onConflictDoNothing();
  } else {
    // Keep name in sync with current user's gender in case caller re-ran with a different profile
    await db.update(user).set({ name: matchName, updatedAt: new Date() }).where(eq(user.id, FIXED_ID));
  }

  // 2. Postgres profile row
  await db.insert(profiles).values({
    userId:              FIXED_ID,
    verificationStatus:  'VERIFIED',
    premiumTier:         'FREE',
    profileCompleteness: 90,
    isActive:            true,
    createdAt:           new Date(),
    updatedAt:           new Date(),
  }).onConflictDoNothing();

  // 3. ProfileContent — engineered to pass bilateral filters with the current user
  const matchContent: Record<string, Record<string, unknown>> = {
    personal: {
      fullName:      matchName,
      dob:           dobFromAge(matchAge),
      gender:        targetGender,
      height:        targetGender === 'FEMALE' ? 165 : 178,
      maritalStatus: 'NEVER_MARRIED',
      motherTongue:  'Hindi',
      religion,
      caste:         'General',
      manglik:       false,
    },
    education:  { degree: 'Masters', college: 'Dev University', year: 2020 },
    profession: { occupation: 'Software Engineer', employer: 'Dev Corp', incomeRange: '10-20 LPA', workLocation: city, employerType: 'PRIVATE' },
    family:     { familyType: 'NUCLEAR', familyValues: 'MODERATE', familyStatus: 'MIDDLE_CLASS' },
    location:   { city, state, country: 'India' },
    lifestyle:  { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER', fitnessLevel: 'MODERATE', languagesSpoken: ['Hindi', 'English'] },
    horoscope:  { rashi: 'Mithun', nakshatra: 'Ardra', manglik: false },
    partnerPreferences: {
      ageRange:         { min: Math.max(18, myAge - 10), max: myAge + 10 },
      heightRange:      { min: 140, max: 210 },
      education:        ['B.Tech', 'M.Tech', 'MBA', 'Masters', 'Bachelors', 'MBBS'],
      religion:         [religion],
      openToInterfaith: true,
      openToInterCaste: true,
      manglik:          'ANY',
      diet:             ['VEG', 'NON_VEG', 'EGGETARIAN'],
      maritalStatus:    ['NEVER_MARRIED'],
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
  };

  if (env.USE_MOCK_SERVICES) {
    for (const [section, value] of Object.entries(matchContent)) {
      mockUpsertField(FIXED_ID, section, value);
    }
  } else {
    const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
    await model.findOneAndUpdate(
      { userId: FIXED_ID },
      { $set: { userId: FIXED_ID, ...matchContent } },
      { upsert: true },
    );
  }

  // 4. Relax current user's partnerPreferences so bilateral filter passes
  const currentPrefs = (currentContent?.['partnerPreferences'] as Record<string, unknown> | undefined) ?? {};
  const relaxedPrefs = {
    ...currentPrefs,
    ageRange:         { min: Math.max(18, matchAge - 10), max: matchAge + 10 },
    heightRange:      { min: 140, max: 210 },
    religion:         [religion],
    openToInterfaith: true,
    openToInterCaste: true,
    manglik:          'ANY',
    diet:             ['VEG', 'NON_VEG', 'EGGETARIAN'],
    maritalStatus:    ['NEVER_MARRIED'],
  };
  if (env.USE_MOCK_SERVICES) {
    mockUpsertField(currentUserId, 'partnerPreferences', relaxedPrefs);
  } else {
    const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
    await model.findOneAndUpdate(
      { userId: currentUserId },
      { $set: { partnerPreferences: relaxedPrefs } },
      { upsert: true },
    );
  }

  // 5. Flush + warm feed cache so /feed returns the new match on next load
  await redis.del(`match_feed:${currentUserId}`);
  await computeAndCacheFeed(currentUserId, db, redis);

  return { matchCreated: true, matchUserId: FIXED_ID, reused };
}
