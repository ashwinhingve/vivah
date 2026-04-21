import { randomUUID } from 'node:crypto';
import { user, profiles } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import { computeAndCacheFeed } from '../matchmaking/engine.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

const FIRST_NAMES_MALE   = ['Arjun', 'Vikram', 'Rohan', 'Karan', 'Dev', 'Siddharth'];
const FIRST_NAMES_FEMALE = ['Priya', 'Ananya', 'Meera', 'Kavya', 'Riya', 'Isha'];
const LAST_NAMES         = ['Sharma', 'Mehta', 'Patel', 'Iyer', 'Kapoor', 'Rao'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function oppositeGender(g: string | undefined): 'MALE' | 'FEMALE' {
  return g === 'FEMALE' ? 'MALE' : 'FEMALE';
}

function dobFromAge(age: number): Date {
  const now = new Date();
  const d = new Date(now);
  d.setFullYear(now.getFullYear() - age);
  // Nudge by a few months so DOB isn't always today
  d.setMonth((d.getMonth() + 3) % 12);
  return d;
}

function safeAge(content: Record<string, unknown> | null): number {
  const personal = content?.['personal'] as { dob?: string | Date } | undefined;
  const dob = personal?.dob ? new Date(personal.dob) : null;
  if (!dob || Number.isNaN(dob.getTime())) return 28;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function safeLocation(content: Record<string, unknown> | null): { city: string; state: string } {
  const loc = content?.['location'] as { city?: string; state?: string } | undefined;
  return { city: loc?.city ?? 'Mumbai', state: loc?.state ?? 'Maharashtra' };
}

function safeReligion(content: Record<string, unknown> | null): string {
  const personal = content?.['personal'] as { religion?: string } | undefined;
  return personal?.religion ?? 'Hindu';
}

/**
 * Creates a profile engineered to match the current user and invalidates the
 * cached feed so it surfaces immediately on next /feed load.
 */
export async function createDevMatch(currentUserId: string): Promise<{ matchCreated: true; matchUserId: string }> {
  const currentContent = mockGet(currentUserId);
  const currentPersonal = currentContent?.['personal'] as { gender?: string; fullName?: string } | undefined;
  const currentGender   = currentPersonal?.gender ?? 'MALE';
  const targetGender    = oppositeGender(currentGender);
  const currentAge      = safeAge(currentContent);
  const { city, state } = safeLocation(currentContent);
  const religion        = safeReligion(currentContent);

  // New user identity
  const matchUserId = `dev-match-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const firstName   = targetGender === 'FEMALE' ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE);
  const lastName    = pick(LAST_NAMES);
  const fullName    = `${firstName} ${lastName}`;
  const matchAge    = currentAge + (targetGender === 'FEMALE' ? -2 : 2); // small age delta

  // 1. Insert Postgres user + profile row
  await db.insert(user).values({
    id:                  matchUserId,
    name:                fullName,
    email:               `${matchUserId}@dev.smartshaadi.co.in`,
    emailVerified:       true,
    phoneNumber:         `+9177${Math.floor(10000000 + Math.random() * 89999999)}`,
    phoneNumberVerified: true,
    role:                'INDIVIDUAL',
    status:              'ACTIVE',
    createdAt:           new Date(),
    updatedAt:           new Date(),
  });
  await db.insert(profiles).values({
    userId:              matchUserId,
    verificationStatus:  'VERIFIED',
    premiumTier:         'FREE',
    profileCompleteness: 90,
    isActive:            true,
    createdAt:           new Date(),
    updatedAt:           new Date(),
  });

  // 2. Build profile content engineered to match current user
  const matchContent: Record<string, Record<string, unknown>> = {
    personal: {
      fullName,
      dob:           dobFromAge(matchAge),
      gender:        targetGender,
      height:        targetGender === 'FEMALE' ? 165 : 178,
      maritalStatus: 'NEVER_MARRIED',
      motherTongue:  'Hindi',
      religion,
      caste:         'General',
      manglik:       false,
    },
    education:  { degree: 'Masters', college: 'Test University', year: 2020 },
    profession: { occupation: 'Software Engineer', employer: 'Test Corp', incomeRange: '10-20 LPA', workLocation: city, employerType: 'PRIVATE' },
    family:     { familyType: 'NUCLEAR', familyValues: 'MODERATE', familyStatus: 'MIDDLE_CLASS' },
    location:   { city, state, country: 'India' },
    lifestyle:  { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER', fitnessLevel: 'MODERATE', languagesSpoken: ['Hindi', 'English'] },
    horoscope:  { rashi: 'Mithun', nakshatra: 'Ardra', manglik: false },
    partnerPreferences: {
      // Wide enough to definitely include the current user
      ageRange:         { min: Math.max(18, currentAge - 10), max: currentAge + 10 },
      heightRange:      { min: 150, max: 200 },
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

  // 3. Write content for the new match (mockStore and, best-effort, Mongo)
  if (env.USE_MOCK_SERVICES) {
    for (const [section, value] of Object.entries(matchContent)) {
      mockUpsertField(matchUserId, section, value);
    }
  } else {
    const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
    await model.findOneAndUpdate({ userId: matchUserId }, { $set: { userId: matchUserId, ...matchContent } }, { upsert: true });
  }

  // 4. Relax current user's partner preferences so the new match passes the
  //    bilateral hard filter (we don't overwrite existing user data otherwise).
  const currentPrefs = currentContent?.['partnerPreferences'] as Record<string, unknown> | undefined;
  const relaxedPrefs = {
    ageRange:         { min: Math.max(18, matchAge - 10), max: matchAge + 10 },
    heightRange:      { min: 140, max: 210 },
    education:        ['B.Tech', 'M.Tech', 'MBA', 'Masters', 'Bachelors', 'MBBS'],
    religion:         [religion],
    openToInterfaith: true,
    openToInterCaste: true,
    manglik:          'ANY',
    diet:             ['VEG', 'NON_VEG', 'EGGETARIAN'],
    maritalStatus:    ['NEVER_MARRIED'],
    ...(currentPrefs ?? {}),
  };
  if (env.USE_MOCK_SERVICES) {
    mockUpsertField(currentUserId, 'partnerPreferences', relaxedPrefs);
  }

  // 5. Drop cached feed — next /feed request recomputes with the new candidate.
  await redis.del(`match_feed:${currentUserId}`);

  // 6. Warm the cache so reload is instant
  await computeAndCacheFeed(currentUserId, db, redis);

  return { matchCreated: true, matchUserId };
}
