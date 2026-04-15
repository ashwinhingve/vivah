// packages/types/src/profile.ts

export type Rashi =
  | 'MESH' | 'VRISHABHA' | 'MITHUN' | 'KARK' | 'SINGH' | 'KANYA'
  | 'TULA' | 'VRISHCHIK' | 'DHANU' | 'MAKAR' | 'KUMBH' | 'MEEN'

export type Nakshatra =
  | 'ASHWINI' | 'BHARANI' | 'KRITTIKA' | 'ROHINI' | 'MRIGASHIRA' | 'ARDRA'
  | 'PUNARVASU' | 'PUSHYA' | 'ASHLESHA' | 'MAGHA' | 'PURVA_PHALGUNI' | 'UTTARA_PHALGUNI'
  | 'HASTA' | 'CHITRA' | 'SWATI' | 'VISHAKHA' | 'ANURADHA' | 'JYESHTHA'
  | 'MULA' | 'PURVA_ASHADHA' | 'UTTARA_ASHADHA' | 'SHRAVANA' | 'DHANISHTA'
  | 'SHATABHISHA' | 'PURVA_BHADRAPADA' | 'UTTARA_BHADRAPADA' | 'REVATI'

export type ManglikStatus = 'YES' | 'NO' | 'PARTIAL'

export const RASHI_LABELS: Record<Rashi, string> = {
  MESH: 'Mesh (Aries)',
  VRISHABHA: 'Vrishabha (Taurus)',
  MITHUN: 'Mithun (Gemini)',
  KARK: 'Kark (Cancer)',
  SINGH: 'Singh (Leo)',
  KANYA: 'Kanya (Virgo)',
  TULA: 'Tula (Libra)',
  VRISHCHIK: 'Vrishchik (Scorpio)',
  DHANU: 'Dhanu (Sagittarius)',
  MAKAR: 'Makar (Capricorn)',
  KUMBH: 'Kumbh (Aquarius)',
  MEEN: 'Meen (Pisces)',
}

export const NAKSHATRA_LABELS: Record<Nakshatra, string> = {
  ASHWINI: 'Ashwini',
  BHARANI: 'Bharani',
  KRITTIKA: 'Krittika',
  ROHINI: 'Rohini',
  MRIGASHIRA: 'Mrigashira',
  ARDRA: 'Ardra',
  PUNARVASU: 'Punarvasu',
  PUSHYA: 'Pushya',
  ASHLESHA: 'Ashlesha',
  MAGHA: 'Magha',
  PURVA_PHALGUNI: 'Purva Phalguni',
  UTTARA_PHALGUNI: 'Uttara Phalguni',
  HASTA: 'Hasta',
  CHITRA: 'Chitra',
  SWATI: 'Swati',
  VISHAKHA: 'Vishakha',
  ANURADHA: 'Anuradha',
  JYESHTHA: 'Jyeshtha',
  MULA: 'Mula',
  PURVA_ASHADHA: 'Purva Ashadha',
  UTTARA_ASHADHA: 'Uttara Ashadha',
  SHRAVANA: 'Shravana',
  DHANISHTA: 'Dhanishta',
  SHATABHISHA: 'Shatabhisha',
  PURVA_BHADRAPADA: 'Purva Bhadrapada',
  UTTARA_BHADRAPADA: 'Uttara Bhadrapada',
  REVATI: 'Revati',
}

export interface ProfilePhotoItem {
  id: string;
  r2Key: string;
  isPrimary: boolean;
  displayOrder: number;
  url?: string;         // presigned R2 URL, populated on read
}

/** Returned by GET /api/v1/profiles/me and GET /api/v1/profiles/:id */
export interface ProfileMetaResponse {
  id: string;
  userId: string;
  name: string;
  role: string;
  status: string;
  phoneNumber: string | null;
  email: string | null;
  verificationStatus: string;
  premiumTier: string;
  profileCompleteness: number;
  isActive: boolean;
  stayQuotient: string | null;
  familyInclinationScore: number | null;
  functionAttendanceScore: number | null;
  photos: ProfilePhotoItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalSection {
  fullName?: string;
  dob?: string;           // ISO-8601 date string
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  height?: number;        // cm
  weight?: number;        // kg
  maritalStatus?: 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';
  motherTongue?: string;
  religion?: string;
  caste?: string;
  subCaste?: string;
  manglik?: boolean;
  gotra?: string;
}

export interface AdditionalDegreeEntry {
  degree?: string;
  college?: string;
  year?: number;
}

export interface EducationSection {
  degree?: string;
  college?: string;
  fieldOfStudy?: string;
  year?: number;
  additionalDegrees?: AdditionalDegreeEntry[];
}

export interface ProfessionSection {
  occupation?: string;
  employer?: string;
  incomeRange?: string;
  workLocation?: string;
  workingAbroad?: boolean;
  employerType?: 'PRIVATE' | 'GOVERNMENT' | 'BUSINESS' | 'SELF_EMPLOYED' | 'NOT_WORKING';
  designation?: string;
  abroadCountry?: string;
}

export interface SiblingEntry {
  name?: string;
  married?: boolean;
  occupation?: string;
}

export interface FamilySection {
  fatherName?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherOccupation?: string;
  siblings?: SiblingEntry[];
  familyType?: 'JOINT' | 'NUCLEAR' | 'EXTENDED';
  familyValues?: 'TRADITIONAL' | 'MODERATE' | 'LIBERAL';
  familyStatus?: 'MIDDLE_CLASS' | 'UPPER_MIDDLE' | 'AFFLUENT';
  nativePlace?: string;
  familyAbout?: string;
}

export interface LocationSection {
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface LifestyleSection {
  diet?: 'VEG' | 'NON_VEG' | 'JAIN' | 'VEGAN' | 'EGGETARIAN';
  smoking?: 'NEVER' | 'OCCASIONALLY' | 'REGULARLY';
  drinking?: 'NEVER' | 'OCCASIONALLY' | 'REGULARLY';
  hobbies?: string[];
  interests?: string[];
  hyperNicheTags?: string[];
  languagesSpoken?: string[];
  ownHouse?: boolean;
  ownCar?: boolean;
  fitnessLevel?: 'ACTIVE' | 'MODERATE' | 'SEDENTARY';
  sunSign?: string;
}

export interface HoroscopeSection {
  rashi?: Rashi;
  nakshatra?: Nakshatra;
  dob?: string;           // ISO-8601 date string
  tob?: string;           // HH:MM
  pob?: string;
  manglik?: ManglikStatus;
  gunaScore?: number;
  chartImageKey?: string;
}

export interface PartnerPreferencesSection {
  ageRange?: { min: number; max: number };
  heightRange?: { min: number; max: number };
  incomeRange?: string;
  education?: string[];
  religion?: string[];
  caste?: string[];
  location?: string[];
  manglik?: 'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK';
  diet?: string[];
  openToInterfaith?: boolean;
  openToInterCaste?: boolean;
  maritalStatus?: ('NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED')[];
  partnerDescription?: string;
}

export interface ProfileSectionCompletion {
  personal: boolean;
  family: boolean;
  career: boolean;
  lifestyle: boolean;
  horoscope: boolean;
  photos: boolean;
  preferences: boolean;
  score: number; // 0-100
}

export interface SafetyModeSection {
  contactHidden: boolean;
  unlockedWith: string[];
}

export interface CommunityZoneData {
  community?: string;
  subCommunity?: string;
  motherTongue?: string;
  preferredLang?: string;
  lgbtqProfile?: boolean;
}

/** Enriched profile returned by GET /api/v1/profiles/:id — includes MongoDB content sections */
export interface ProfileDetailResponse extends ProfileMetaResponse {
  personal?: PersonalSection;
  education?: EducationSection;
  profession?: ProfessionSection;
  family?: FamilySection;
  location?: LocationSection;
  lifestyle?: LifestyleSection;
  horoscope?: HoroscopeSection;
  partnerPreferences?: PartnerPreferencesSection;
  aboutMe?: string;
  sectionCompletion?: ProfileSectionCompletion;
}

/** Returned by GET /api/v1/profiles/me/content */
export interface ProfileContentResponse {
  userId: string;
  personal?: PersonalSection;
  education?: EducationSection;
  profession?: ProfessionSection;
  family?: FamilySection;
  location?: LocationSection;
  lifestyle?: LifestyleSection;
  horoscope?: HoroscopeSection;
  partnerPreferences?: PartnerPreferencesSection;
  safetyMode?: SafetyModeSection;
  aboutMe?: string;
  partnerDescription?: string;
  communityZone?: string;
  lgbtqProfile?: boolean;
  createdAt: string;
  updatedAt: string;
}
