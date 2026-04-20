import type { Model } from 'mongoose';
import { profiles } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';

const CITIES = [
  { city: 'Mumbai',    state: 'Maharashtra' },
  { city: 'Delhi',     state: 'Delhi' },
  { city: 'Bangalore', state: 'Karnataka' },
  { city: 'Pune',      state: 'Maharashtra' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Chennai',   state: 'Tamil Nadu' },
];

const RASHIS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo'];
const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra'];

function deterministicDob(index: number): Date {
  const year = 1988 + (index % 13); // 1988..2000
  const month = (index * 3) % 12;
  const day = ((index * 7) % 27) + 1;
  return new Date(Date.UTC(year, month, day));
}

function buildContent(index: number, userId: string): Record<string, unknown> {
  const gender = index % 2 === 0 ? 'MALE' : 'FEMALE';
  const loc = CITIES[index % CITIES.length]!;
  return {
    userId,
    personal: {
      fullName: `Test User ${index + 1}`,
      dob: deterministicDob(index),
      gender,
      height: 160 + (index % 20),
      maritalStatus: 'NEVER_MARRIED',
      motherTongue: 'Hindi',
      religion: 'Hindu',
      caste: 'General',
    },
    education: {
      degree: 'BTech',
      college: 'Test University',
      fieldOfStudy: 'Computer Science',
      year: 2018,
    },
    profession: {
      occupation: 'Software Engineer',
      employer: 'Test Corp',
      incomeRange: '10-20 LPA',
      employerType: 'PRIVATE',
    },
    family: {
      familyType: 'NUCLEAR',
      familyValues: 'MODERATE',
      familyStatus: 'MIDDLE_CLASS',
    },
    location: {
      city: loc.city,
      state: loc.state,
      country: 'India',
    },
    lifestyle: {
      diet: 'VEG',
      smoking: 'NEVER',
      drinking: 'NEVER',
      fitnessLevel: 'MODERATE',
    },
    horoscope: {
      rashi: RASHIS[index % RASHIS.length]!,
      nakshatra: NAKSHATRAS[index % NAKSHATRAS.length]!,
      manglik: 'NO',
    },
    partnerPreferences: {
      ageRange: { min: 22, max: 35 },
      heightRange: { min: 150, max: 185 },
      religion: ['Hindu'],
      openToInterfaith: false,
      openToInterCaste: true,
    },
    safetyMode: {
      contactHidden: true,
      unlockedWith: [],
    },
    communityZone: 'General',
  };
}

export interface SeedResult {
  created: number;
  skipped: number;
  total: number;
}

export async function seedProfileContent(): Promise<SeedResult> {
  const rows = await db.select({ id: profiles.id, userId: profiles.userId }).from(profiles);
  let created = 0;
  let skipped = 0;

  if (env.USE_MOCK_SERVICES) {
    for (let i = 0; i < rows.length; i++) {
      const { userId } = rows[i]!;
      const existing = mockGet(userId);
      const existingPersonal = existing?.['personal'] as { fullName?: string } | undefined;
      if (existingPersonal?.fullName) {
        skipped++;
        continue;
      }
      const content = buildContent(i, userId);
      for (const [section, value] of Object.entries(content)) {
        if (section === 'userId') continue;
        mockUpsertField(userId, section, value);
      }
      created++;
    }
    return { created, skipped, total: rows.length };
  }

  const model = ProfileContent as unknown as Model<{ userId: string; [key: string]: unknown }>;
  for (let i = 0; i < rows.length; i++) {
    const { userId } = rows[i]!;
    const existing = await model.findOne({ userId }, { 'personal.fullName': 1 }).lean();
    const existingPersonal = (existing as { personal?: { fullName?: string } } | null)?.personal;
    if (existingPersonal?.fullName) {
      skipped++;
      continue;
    }
    const content = buildContent(i, userId);
    await model.findOneAndUpdate({ userId }, { $set: content }, { upsert: true, new: true });
    created++;
  }
  return { created, skipped, total: rows.length };
}
