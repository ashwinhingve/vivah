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
});

export const UpdateProfessionSchema = z.object({
  occupation:    z.string().max(255).optional(),
  employer:      z.string().max(255).optional(),
  incomeRange:   z.string().max(50).optional(),
  workLocation:  z.string().max(255).optional(),
  workingAbroad: z.boolean().optional(),
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
  siblings:         z.array(siblingSchema).optional(),
  familyType:       z.enum(['JOINT', 'NUCLEAR', 'EXTENDED']).optional(),
  familyValues:     z.enum(['TRADITIONAL', 'MODERATE', 'LIBERAL']).optional(),
  familyStatus:     z.enum(['MIDDLE_CLASS', 'UPPER_MIDDLE', 'AFFLUENT']).optional(),
});

export const UpdateLocationSchema = z.object({
  city:    z.string().max(100).optional(),
  state:   z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
});

export const UpdateLifestyleSchema = z.object({
  diet:           z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN']).optional(),
  smoking:        z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']).optional(),
  drinking:       z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']).optional(),
  hobbies:        z.array(z.string().max(100)).optional(),
  interests:      z.array(z.string().max(100)).optional(),
  hyperNicheTags: z.array(z.string().max(100)).optional(),
});

export const UpdateHoroscopeSchema = z.object({
  rashi:     z.string().max(50).optional(),
  nakshatra: z.string().max(50).optional(),
  dob:       z.string().datetime({ offset: true }).optional(),
  tob:       z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').optional(),
  pob:       z.string().max(255).optional(),
  manglik:   z.boolean().optional(),
});

const rangeSchema = (min: number, max: number) =>
  z.object({
    min: z.number().int().min(min).max(max),
    max: z.number().int().min(min).max(max),
  });

export const UpdatePartnerPreferencesSchema = z.object({
  ageRange:         rangeSchema(18, 100).optional(),
  heightRange:      rangeSchema(100, 250).optional(),
  incomeRange:      z.string().max(50).optional(),
  education:        z.array(z.string().max(255)).optional(),
  religion:         z.array(z.string().max(100)).optional(),
  caste:            z.array(z.string().max(100)).optional(),
  location:         z.array(z.string().max(100)).optional(),
  manglik:          z.enum(['ANY', 'ONLY_MANGLIK', 'NON_MANGLIK']).optional(),
  diet:             z.array(z.string().max(50)).optional(),
  openToInterfaith: z.boolean().optional(),
  openToInterCaste: z.boolean().optional(),
});

// ── Inferred input types ──────────────────────────────────────────────────────

export type UpdateProfileMetaInput      = z.infer<typeof UpdateProfileMetaSchema>;
export type AddPhotoInput               = z.infer<typeof AddPhotoSchema>;
export type UpdatePersonalInput         = z.infer<typeof UpdatePersonalSchema>;
export type UpdateEducationInput        = z.infer<typeof UpdateEducationSchema>;
export type UpdateProfessionInput       = z.infer<typeof UpdateProfessionSchema>;
export type UpdateFamilyInput           = z.infer<typeof UpdateFamilySchema>;
export type UpdateLocationInput         = z.infer<typeof UpdateLocationSchema>;
export type UpdateLifestyleInput        = z.infer<typeof UpdateLifestyleSchema>;
export type UpdateHoroscopeInput        = z.infer<typeof UpdateHoroscopeSchema>;
export type UpdatePartnerPreferencesInput = z.infer<typeof UpdatePartnerPreferencesSchema>;
