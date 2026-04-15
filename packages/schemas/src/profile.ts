// packages/schemas/src/profile.ts
import { z } from 'zod';

// ── Metadata (PostgreSQL profile row) ─────────────────────────────────────────

export const UpdateProfileMetaSchema = z.object({
  stayQuotient:            z.enum(['INDEPENDENT', 'WITH_PARENTS', 'WITH_INLAWS', 'FLEXIBLE']).optional(),
  familyInclinationScore:  z.number().int().min(0).max(100).optional(),
  functionAttendanceScore: z.number().int().min(0).max(100).optional(),
  isActive:                z.boolean().optional(),
});

export const AddPhotoSchema = z.object({
  r2Key:        z.string().min(1),
  isPrimary:    z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const PhotoUploadSchema = z.object({
  r2Key:        z.string().min(1),
  fileSize:     z.number().int().min(1).max(10 * 1024 * 1024), // max 10MB in bytes
  mimeType:     z.enum(['image/jpeg', 'image/png', 'image/webp']),
  isPrimary:    z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const PhotoReorderSchema = z.array(
  z.object({
    id:           z.string().uuid(),
    displayOrder: z.number().int().min(0).max(20),
  })
).min(1).max(20);

export const SetPrimaryPhotoSchema = z.object({
  photoId: z.string().uuid(),
});

// ── Content sections (MongoDB ProfileContent) ─────────────────────────────────

export const UpdatePersonalSchema = z.object({
  fullName:      z.string().min(1).max(255).optional(),
  dob:           z.string().datetime({ offset: true }).optional(),
  gender:        z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  height:        z.number().int().min(100).max(250).optional(),
  weight:        z.number().int().min(30).max(200).optional(),
  maritalStatus: z.enum(['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED']).optional(),
  motherTongue:  z.string().max(50).optional(),
  religion:      z.string().max(100).optional(),
  caste:         z.string().max(100).optional(),
  subCaste:      z.string().max(100).optional(),
  manglik:       z.boolean().optional(),
  gotra:         z.string().max(100).optional(),
});

export const UpdateEducationSchema = z.object({
  degree:       z.string().max(255).optional(),
  college:      z.string().max(255).optional(),
  fieldOfStudy: z.string().max(255).optional(),
  year:         z.number().int().min(1950).max(2030).optional(),
  additionalDegrees: z.array(z.object({
    degree:  z.string().max(100).optional(),
    college: z.string().max(200).optional(),
    year:    z.number().int().min(1950).max(2030).optional(),
  })).max(5).optional(),
});

export const UpdateProfessionSchema = z.object({
  occupation:    z.string().max(255).optional(),
  employer:      z.string().max(255).optional(),
  incomeRange:   z.string().max(50).optional(),
  workLocation:  z.string().max(255).optional(),
  workingAbroad: z.boolean().optional(),
  employerType:  z.enum(['PRIVATE', 'GOVERNMENT', 'BUSINESS', 'SELF_EMPLOYED', 'NOT_WORKING']).optional(),
  designation:   z.string().max(100).optional(),
  abroadCountry: z.string().max(100).optional(),
});

const siblingSchema = z.object({
  name:       z.string().max(255).optional(),
  married:    z.boolean().optional(),
  occupation: z.string().max(255).optional(),
});

export const UpdateFamilySchema = z.object({
  fatherName:       z.string().max(255).optional(),
  fatherOccupation: z.string().max(255).optional(),
  motherName:       z.string().max(255).optional(),
  motherOccupation: z.string().max(255).optional(),
  siblings:         z.array(siblingSchema).max(10).optional(),
  familyType:       z.enum(['JOINT', 'NUCLEAR', 'EXTENDED']).optional(),
  familyValues:     z.enum(['TRADITIONAL', 'MODERATE', 'LIBERAL']).optional(),
  familyStatus:     z.enum(['MIDDLE_CLASS', 'UPPER_MIDDLE', 'AFFLUENT']).optional(),
  nativePlace:      z.string().max(100).optional(),
  familyAbout:      z.string().max(500).optional(),
});

export const UpdateLocationSchema = z.object({
  city:    z.string().max(100).optional(),
  state:   z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
});

export const HYPER_NICHE_TAGS = [
  'career-first', 'entrepreneur', 'spiritual', 'environmentalist',
  'fitness-enthusiast', 'foodie', 'traveller', 'artist', 'social-worker',
  'NRI', 'manglik', 'divorcee-friendly', 'differently-abled-friendly',
  'joint-family', 'nuclear-family', 'pet-lover', 'minimalist',
] as const;

export const UpdateLifestyleSchema = z.object({
  diet:               z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN']).optional(),
  smoking:            z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']).optional(),
  drinking:           z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']).optional(),
  hobbies:            z.array(z.string().max(100)).optional(),
  interests:          z.array(z.string().max(100)).optional(),
  hyperNicheTags:     z.array(z.enum(HYPER_NICHE_TAGS)).optional(),
  languagesSpoken:    z.array(z.string().max(30)).max(10).optional(),
  ownHouse:           z.boolean().optional(),
  ownCar:             z.boolean().optional(),
  fitnessLevel:       z.enum(['ACTIVE', 'MODERATE', 'SEDENTARY']).nullable().optional(),
  sunSign:            z.string().max(20).optional(),
});

const RASHI_VALUES = [
  'MESH','VRISHABHA','MITHUN','KARK','SINGH','KANYA',
  'TULA','VRISHCHIK','DHANU','MAKAR','KUMBH','MEEN',
] as const

const NAKSHATRA_VALUES = [
  'ASHWINI','BHARANI','KRITTIKA','ROHINI','MRIGASHIRA','ARDRA',
  'PUNARVASU','PUSHYA','ASHLESHA','MAGHA','PURVA_PHALGUNI','UTTARA_PHALGUNI',
  'HASTA','CHITRA','SWATI','VISHAKHA','ANURADHA','JYESHTHA',
  'MULA','PURVA_ASHADHA','UTTARA_ASHADHA','SHRAVANA','DHANISHTA',
  'SHATABHISHA','PURVA_BHADRAPADA','UTTARA_BHADRAPADA','REVATI',
] as const

export const UpdateHoroscopeSchema = z.object({
  rashi:     z.enum(RASHI_VALUES).optional(),
  nakshatra: z.enum(NAKSHATRA_VALUES).optional(),
  dob:       z.string().datetime({ offset: true }).optional(),
  tob:       z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').optional(),
  pob:       z.string().max(255).optional(),
  manglik:   z.enum(['YES','NO','PARTIAL']).optional(),
});

const rangeSchema = (min: number, max: number) =>
  z.object({
    min: z.number().int().min(min).max(max),
    max: z.number().int().min(min).max(max),
  });

export const UpdatePartnerPreferencesSchema = z.object({
  ageRange:           rangeSchema(18, 100).optional(),
  heightRange:        rangeSchema(100, 250).optional(),
  incomeRange:        z.string().max(50).optional(),
  education:          z.array(z.string().max(255)).optional(),
  religion:           z.array(z.string().max(100)).optional(),
  caste:              z.array(z.string().max(100)).optional(),
  location:           z.array(z.string().max(100)).optional(),
  manglik:            z.enum(['ANY', 'ONLY_MANGLIK', 'NON_MANGLIK']).optional(),
  diet:               z.array(z.string().max(50)).optional(),
  openToInterfaith:   z.boolean().optional(),
  openToInterCaste:   z.boolean().optional(),
  maritalStatus:      z.array(z.enum(['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'])).optional(),
  partnerDescription: z.string().max(1000).optional(),
}).refine(
  d => d.ageRange == null || d.ageRange.min <= d.ageRange.max,
  { message: 'ageRange.min must be ≤ ageRange.max', path: ['ageRange'] },
).refine(
  d => d.heightRange == null || d.heightRange.min <= d.heightRange.max,
  { message: 'heightRange.min must be ≤ heightRange.max', path: ['heightRange'] },
);

export const INDIAN_LANGUAGES = ['hi','en','mr','gu','ta','te','kn','ml','pa','bn','or','as'] as const

export const UpdateCommunityZoneSchema = z.object({
  community:    z.string().max(100).optional(),
  subCommunity: z.string().max(100).optional(),
  motherTongue: z.string().max(50).optional(),
  preferredLang: z.enum(INDIAN_LANGUAGES).optional(),
  lgbtqProfile: z.boolean().optional(),
});

// ── Inferred input types ──────────────────────────────────────────────────────

export const ProfileBulkUpdateSchema = z.object({
  family:     UpdateFamilySchema.optional(),
  education:  UpdateEducationSchema.optional(),
  profession: UpdateProfessionSchema.optional(),
  lifestyle:  UpdateLifestyleSchema.optional(),
}).refine(data => Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined).length > 0, {
  message: 'At least one section is required',
});

// ── Inferred input types ──────────────────────────────────────────────────────

export type UpdateProfileMetaInput        = z.infer<typeof UpdateProfileMetaSchema>;
export type AddPhotoInput                 = z.infer<typeof AddPhotoSchema>;
export type PhotoUploadInput              = z.infer<typeof PhotoUploadSchema>;
export type PhotoReorderInput             = z.infer<typeof PhotoReorderSchema>;
export type SetPrimaryPhotoInput          = z.infer<typeof SetPrimaryPhotoSchema>;
export type UpdatePersonalInput           = z.infer<typeof UpdatePersonalSchema>;
export type UpdateEducationInput          = z.infer<typeof UpdateEducationSchema>;
export type UpdateProfessionInput         = z.infer<typeof UpdateProfessionSchema>;
export type UpdateFamilyInput             = z.infer<typeof UpdateFamilySchema>;
export type UpdateLocationInput           = z.infer<typeof UpdateLocationSchema>;
export type UpdateLifestyleInput          = z.infer<typeof UpdateLifestyleSchema>;
export type UpdateHoroscopeInput          = z.infer<typeof UpdateHoroscopeSchema>;
export type UpdatePartnerPreferencesInput = z.infer<typeof UpdatePartnerPreferencesSchema>;
export type ProfileBulkUpdateInput        = z.infer<typeof ProfileBulkUpdateSchema>;
export type UpdateCommunityZoneInput      = z.infer<typeof UpdateCommunityZoneSchema>;
