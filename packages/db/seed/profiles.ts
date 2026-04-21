/**
 * MongoDB ProfileContent seed — populates rich profile data for test users.
 * Requires MONGODB_URI in root .env
 */
import mongoose from 'mongoose';
import { Schema, model, models } from 'mongoose';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

config({ path: resolve(__dirname, '../../../.env') });

const MONGO_URI = process.env['MONGODB_URI'];

// Inline minimal ProfileContent schema for seeding (avoids TS path issues in seed context)
const profileContentSchema = new Schema(
  {
    userId:       { type: String, required: true, unique: true, index: true },
    personal:     Schema.Types.Mixed,
    education:    Schema.Types.Mixed,
    profession:   Schema.Types.Mixed,
    family:       Schema.Types.Mixed,
    location:     Schema.Types.Mixed,
    lifestyle:    Schema.Types.Mixed,
    horoscope:    Schema.Types.Mixed,
    partnerPreferences: Schema.Types.Mixed,
    safetyMode:   Schema.Types.Mixed,
    aboutMe:      String,
  },
  { collection: 'profiles_content', timestamps: true },
);

const ProfileContent = (models['ProfileContent'] ?? model('ProfileContent', profileContentSchema)) as ReturnType<typeof model>;

const SEED_PROFILES = [
  {
    userId: 'seed-individual-001',
    personal: {
      fullName:      'Priya Sharma',
      dob:           new Date('1997-03-15'),
      gender:        'FEMALE',
      height:        163,
      weight:        55,
      complexion:    'FAIR',
      maritalStatus: 'NEVER_MARRIED',
      motherTongue:  'Hindi',
      religion:      'Hindu',
      caste:         'Brahmin',
      subCaste:      'Saraswat',
      manglik:       false,
      gotra:         'Kashyap',
    },
    education: {
      degree:       'B.Tech',
      college:      'IIT Delhi',
      fieldOfStudy: 'Computer Science',
      year:         2019,
    },
    profession: {
      occupation:    'Software Engineer',
      employer:      'Infosys',
      incomeRange:   '10-15 LPA',
      workLocation:  'Pune',
      workingAbroad: false,
      employerType:  'PRIVATE',
      designation:   'Senior Engineer',
    },
    family: {
      fatherName:       'Rajesh Sharma',
      fatherOccupation: 'Government Officer',
      motherName:       'Sunita Sharma',
      motherOccupation: 'Homemaker',
      siblings: [{ name: 'Rohit Sharma', married: false, occupation: 'Student' }],
      familyType:   'JOINT',
      familyValues: 'MODERATE',
      familyStatus: 'MIDDLE_CLASS',
      nativePlace:  'Jaipur, Rajasthan',
    },
    location: {
      city:    'Pune',
      state:   'Maharashtra',
      country: 'India',
    },
    lifestyle: {
      diet:            'VEG',
      smoking:         'NEVER',
      drinking:        'NEVER',
      hobbies:         ['Reading', 'Cooking', 'Yoga'],
      interests:       ['Technology', 'Travel', 'Music'],
      hyperNicheTags:  ['career-first', 'spiritual'],
      languagesSpoken: ['Hindi', 'English', 'Marathi'],
      ownHouse:        false,
      ownCar:          true,
      fitnessLevel:    'ACTIVE',
    },
    horoscope: {
      rashi:    'Mithun',
      nakshatra: 'Ardra',
      dob:       new Date('1997-03-15'),
      tob:       '10:30',
      pob:       'Jaipur, Rajasthan',
      manglik:   false,
    },
    partnerPreferences: {
      ageRange:         { min: 24, max: 42 },
      heightRange:      { min: 165, max: 195 },
      education:        ['B.Tech', 'M.Tech', 'MBA', 'Masters', 'Bachelors'],
      religion:         ['Hindu'],
      manglik:          'ANY',
      diet:             ['VEG', 'NON_VEG'],
      openToInterfaith: true,
      openToInterCaste: true,
      maritalStatus:    ['NEVER_MARRIED'],
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
    aboutMe: 'Software engineer at Infosys, passionate about technology and music. Looking for a life partner who values family and personal growth.',
  },
  {
    userId: 'seed-individual-002',
    personal: {
      fullName:      'Arjun Mehta',
      dob:           new Date('1994-08-22'),
      gender:        'MALE',
      height:        178,
      weight:        72,
      complexion:    'WHEATISH',
      maritalStatus: 'NEVER_MARRIED',
      motherTongue:  'Gujarati',
      religion:      'Hindu',
      caste:         'Vania',
      subCaste:      'Shrimali',
      manglik:       false,
      gotra:         'Bharadwaj',
    },
    education: {
      degree:       'MBA',
      college:      'IIM Ahmedabad',
      fieldOfStudy: 'Finance',
      year:         2020,
    },
    profession: {
      occupation:    'Business Analyst',
      employer:      'Deloitte',
      incomeRange:   '15-25 LPA',
      workLocation:  'Mumbai',
      workingAbroad: false,
      employerType:  'PRIVATE',
      designation:   'Senior Consultant',
    },
    family: {
      fatherName:       'Suresh Mehta',
      fatherOccupation: 'Businessman',
      motherName:       'Rekha Mehta',
      motherOccupation: 'Homemaker',
      siblings: [],
      familyType:   'NUCLEAR',
      familyValues: 'MODERATE',
      familyStatus: 'UPPER_MIDDLE',
      nativePlace:  'Surat, Gujarat',
    },
    location: {
      city:    'Mumbai',
      state:   'Maharashtra',
      country: 'India',
    },
    lifestyle: {
      diet:            'NON_VEG',
      smoking:         'NEVER',
      drinking:        'OCCASIONALLY',
      hobbies:         ['Cricket', 'Trekking', 'Photography'],
      interests:       ['Finance', 'Sports', 'Travel'],
      hyperNicheTags:  ['career-first', 'environmentalist'],
      languagesSpoken: ['Gujarati', 'Hindi', 'English'],
      ownHouse:        false,
      ownCar:          true,
      fitnessLevel:    'MODERATE',
    },
    horoscope: {
      rashi:    'Simha',
      nakshatra: 'Magha',
      dob:       new Date('1994-08-22'),
      tob:       '14:15',
      pob:       'Surat, Gujarat',
      manglik:   false,
    },
    partnerPreferences: {
      ageRange:         { min: 22, max: 40 },
      heightRange:      { min: 150, max: 185 },
      education:        ['B.Tech', 'MBA', 'MBBS', 'Masters', 'Bachelors'],
      religion:         ['Hindu'],
      manglik:          'ANY',
      diet:             ['VEG', 'NON_VEG'],
      openToInterfaith: true,
      openToInterCaste: true,
      maritalStatus:    ['NEVER_MARRIED'],
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
    aboutMe: 'Finance professional at Deloitte, love trekking and cricket. Seeking a partner who balances career ambition with family values.',
  },
  {
    userId: 'seed-individual-003',
    personal: {
      fullName: 'Ananya Iyer', dob: new Date('1999-06-12'), gender: 'FEMALE',
      height: 168, maritalStatus: 'NEVER_MARRIED', motherTongue: 'Tamil',
      religion: 'Hindu', caste: 'Iyer', manglik: false,
    },
    education:   { degree: 'MBBS', college: 'AIIMS Delhi', year: 2023 },
    profession:  { occupation: 'Doctor', employer: 'Apollo Hospitals', incomeRange: '8-12 LPA', workLocation: 'Bengaluru', employerType: 'PRIVATE' },
    family:      { familyType: 'NUCLEAR', familyValues: 'LIBERAL', familyStatus: 'UPPER_MIDDLE' },
    location:    { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    lifestyle:   { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER', languagesSpoken: ['Tamil', 'English', 'Hindi'] },
    horoscope:   { rashi: 'Mithun', nakshatra: 'Punarvasu', manglik: false },
    partnerPreferences: {
      ageRange: { min: 22, max: 40 }, heightRange: { min: 160, max: 195 },
      education: ['B.Tech', 'MBA', 'MBBS', 'Masters'], religion: ['Hindu'],
      openToInterfaith: true, openToInterCaste: true, diet: ['VEG', 'NON_VEG'],
      maritalStatus: ['NEVER_MARRIED'],
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
    aboutMe: 'Resident doctor at Apollo, love classical music and weekend hikes.',
  },
  {
    userId: 'seed-individual-004',
    personal: {
      fullName: 'Vikram Patel', dob: new Date('1993-11-04'), gender: 'MALE',
      height: 182, maritalStatus: 'NEVER_MARRIED', motherTongue: 'Gujarati',
      religion: 'Hindu', caste: 'Patel', manglik: false,
    },
    education:   { degree: 'M.Tech', college: 'BITS Pilani', year: 2017 },
    profession:  { occupation: 'Product Manager', employer: 'Flipkart', incomeRange: '20-30 LPA', workLocation: 'Bengaluru', employerType: 'PRIVATE' },
    family:      { familyType: 'NUCLEAR', familyValues: 'MODERATE', familyStatus: 'UPPER_MIDDLE' },
    location:    { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    lifestyle:   { diet: 'VEG', smoking: 'NEVER', drinking: 'OCCASIONALLY', languagesSpoken: ['Gujarati', 'Hindi', 'English'] },
    horoscope:   { rashi: 'Vrischika', nakshatra: 'Jyeshta', manglik: false },
    partnerPreferences: {
      ageRange: { min: 22, max: 40 }, heightRange: { min: 150, max: 180 },
      education: ['B.Tech', 'MBA', 'MBBS', 'Masters', 'Bachelors'], religion: ['Hindu'],
      openToInterfaith: true, openToInterCaste: true, diet: ['VEG', 'NON_VEG'],
      maritalStatus: ['NEVER_MARRIED'],
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
    aboutMe: 'Product manager at Flipkart, weekend cyclist. Looking for someone warm and ambitious.',
  },
];

/**
 * Mirror SEED_PROFILES into the mockStore.json file that apps/api reads when
 * USE_MOCK_SERVICES=true. The matchmaking engine enriches candidate rows from
 * this store before running hard filters, so without it seeded profiles can't
 * show up in the feed.
 */
function writeMockStore(): void {
  const STORE_FILE = resolve(__dirname, '../../../apps/api/.data/mockStore.json');
  let existing: Record<string, Record<string, unknown>> = {};
  try {
    existing = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Record<string, Record<string, unknown>>;
  } catch { /* file missing — start fresh */ }

  for (const p of SEED_PROFILES) {
    existing[p.userId] = { ...(existing[p.userId] ?? { userId: p.userId }), ...p };
  }

  mkdirSync(dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(existing, null, 2), 'utf8');
  console.info(`  ✅ mockStore.json updated with ${SEED_PROFILES.length} profiles`);
}

export async function seedProfileContent(): Promise<void> {
  // Always write mockStore so dev mock mode sees candidate data.
  writeMockStore();

  if (!MONGO_URI) {
    console.warn('⚠️  MONGODB_URI not set — skipping MongoDB profile seed');
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    for (const profileData of SEED_PROFILES) {
      await ProfileContent.findOneAndUpdate(
        { userId: profileData.userId },
        profileData,
        { upsert: true, new: true },
      );
      console.info(`  ✅ ProfileContent upserted for ${profileData.userId}`);
    }
    console.info('✅ MongoDB profile content seeded');
    await mongoose.disconnect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`⚠️  MongoDB seed skipped (${msg}). mockStore.json is still populated.`);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}
