/**
 * MongoDB ProfileContent seed — populates rich profile data for test users.
 * Requires MONGODB_URI in root .env
 */
import mongoose from 'mongoose';
import { Schema, model, models } from 'mongoose';
import { config } from 'dotenv';
import { resolve } from 'path';

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
      ageRange:         { min: 28, max: 35 },
      heightRange:      { min: 170, max: 190 },
      education:        ['B.Tech', 'M.Tech', 'MBA'],
      religion:         ['Hindu'],
      manglik:          'ANY',
      diet:             ['VEG'],
      openToInterfaith: false,
      openToInterCaste: false,
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
      ageRange:         { min: 24, max: 30 },
      heightRange:      { min: 155, max: 175 },
      education:        ['B.Tech', 'MBA', 'MBBS'],
      religion:         ['Hindu'],
      manglik:          'NON_MANGLIK',
      diet:             ['VEG', 'NON_VEG'],
      openToInterfaith: false,
      openToInterCaste: true,
      maritalStatus:    ['NEVER_MARRIED'],
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
    aboutMe: 'Finance professional at Deloitte, love trekking and cricket. Seeking a partner who balances career ambition with family values.',
  },
];

export async function seedProfileContent(): Promise<void> {
  if (!MONGO_URI) {
    console.warn('⚠️  MONGODB_URI not set — skipping MongoDB profile seed');
    return;
  }

  await mongoose.connect(MONGO_URI);

  for (const profileData of SEED_PROFILES) {
    await ProfileContent.findOneAndUpdate(
      { userId: profileData.userId },
      profileData,
      { upsert: true, new: true },
    );
    console.info(`  ✅ ProfileContent upserted for ${profileData.userId}`);
  }

  // Also add seed-individual-002 as a user if not already done
  // (profile seeder creates MongoDB content; PostgreSQL row created by auth seeder)
  console.info('✅ MongoDB profile content seeded');
  await mongoose.disconnect();
}
