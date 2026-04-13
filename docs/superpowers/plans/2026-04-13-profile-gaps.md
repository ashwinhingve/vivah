# Profile Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill three Day-5 gaps: add shared profile TypeScript types and Zod schemas, build nine `/me/content/*` sub-endpoints backed by MongoDB, fix the photo-registration bug, and extend the 3-step wizard with a personal-details step.

**Architecture:** Approach B (separate sub-endpoints). `GET/PUT /api/v1/profiles/me/content/*` uses a new `content.router.ts` + `content.service.ts` that reads/writes the existing Mongoose `ProfileContent` model. The content router is mounted inside `profiles/router.ts` (before the `/:id` catch-all) so Express never confuses `/me/content` with a profile UUID. Shared types live in `packages/types`, shared schemas in `packages/schemas`; both are already declared as API deps.

**Tech Stack:** TypeScript strict · Zod · Mongoose (MongoDB) · Express · Vitest · Next.js 15 (wizard fix)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/types/src/profile.ts` | All profile-related TS interfaces |
| Modify | `packages/types/src/index.ts` | Re-export profile types |
| Create | `packages/types/src/__tests__/profile.test.ts` | Type-shape smoke tests |
| Create | `packages/schemas/src/profile.ts` | All profile Zod schemas + inferred types |
| Modify | `packages/schemas/src/index.ts` | Re-export profile schemas |
| Create | `packages/schemas/src/__tests__/profile.test.ts` | Schema validation tests |
| Create | `apps/api/src/profiles/content.service.ts` | MongoDB upsert logic for each section |
| Create | `apps/api/src/profiles/content.router.ts` | Express routes for GET + 8 PUT endpoints |
| Modify | `apps/api/src/profiles/router.ts` | Mount `profileContentRouter` before `/:id` |
| Modify | `apps/web/src/app/(profile)/create/page.tsx` | New Step 1 (personal), renumber, fix photo bug |

---

## Task 1 — Profile TypeScript Types

**Files:**
- Create: `packages/types/src/profile.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/types/src/__tests__/profile.test.ts`

- [ ] **Step 1.1 — Write `packages/types/src/profile.ts`**

```typescript
// packages/types/src/profile.ts

export interface ProfilePhotoItem {
  id: string;
  r2Key: string;
  isPrimary: boolean;
  displayOrder: number;
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

export interface EducationSection {
  degree?: string;
  college?: string;
  fieldOfStudy?: string;
  year?: number;
}

export interface ProfessionSection {
  occupation?: string;
  employer?: string;
  incomeRange?: string;
  workLocation?: string;
  workingAbroad?: boolean;
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
}

export interface HoroscopeSection {
  rashi?: string;
  nakshatra?: string;
  dob?: string;           // ISO-8601 date string
  tob?: string;           // HH:MM
  pob?: string;
  manglik?: boolean;
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
}

export interface SafetyModeSection {
  contactHidden: boolean;
  unlockedWith: string[];
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
```

- [ ] **Step 1.2 — Add export to `packages/types/src/index.ts`**

Replace file content with:

```typescript
export * from './auth.js';
export * from './kyc.js';
export * from './design-tokens.js';
export * from './profile.js';
```

- [ ] **Step 1.3 — Write `packages/types/src/__tests__/profile.test.ts`**

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type {
  ProfileMetaResponse,
  ProfileContentResponse,
  PersonalSection,
  PartnerPreferencesSection,
} from '../profile.js';

describe('ProfileMetaResponse', () => {
  it('has required id and userId as strings', () => {
    expectTypeOf<ProfileMetaResponse['id']>().toEqualTypeOf<string>();
    expectTypeOf<ProfileMetaResponse['userId']>().toEqualTypeOf<string>();
  });

  it('has nullable phoneNumber and email', () => {
    expectTypeOf<ProfileMetaResponse['phoneNumber']>().toEqualTypeOf<string | null>();
    expectTypeOf<ProfileMetaResponse['email']>().toEqualTypeOf<string | null>();
  });
});

describe('ProfileContentResponse', () => {
  it('has all sections as optional', () => {
    expectTypeOf<ProfileContentResponse['personal']>().toEqualTypeOf<PersonalSection | undefined>();
    expectTypeOf<ProfileContentResponse['partnerPreferences']>().toEqualTypeOf<PartnerPreferencesSection | undefined>();
  });

  it('has required userId, createdAt, updatedAt', () => {
    expectTypeOf<ProfileContentResponse['userId']>().toEqualTypeOf<string>();
    expectTypeOf<ProfileContentResponse['createdAt']>().toEqualTypeOf<string>();
  });
});

describe('PersonalSection', () => {
  it('gender is a union literal or undefined', () => {
    expectTypeOf<PersonalSection['gender']>().toEqualTypeOf<'MALE' | 'FEMALE' | 'OTHER' | undefined>();
  });

  it('maritalStatus is a union literal or undefined', () => {
    expectTypeOf<PersonalSection['maritalStatus']>().toEqualTypeOf<
      'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED' | undefined
    >();
  });
});
```

- [ ] **Step 1.4 — Run the type tests**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS/packages/types
pnpm test
```

Expected: all tests pass (these are compile-time type assertions via `expectTypeOf`).

- [ ] **Step 1.5 — Commit**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git add packages/types/src/profile.ts packages/types/src/index.ts packages/types/src/__tests__/profile.test.ts
git commit -m "feat(types): add profile TypeScript interfaces"
```

---

## Task 2 — Profile Zod Schemas

**Files:**
- Create: `packages/schemas/src/profile.ts`
- Modify: `packages/schemas/src/index.ts`
- Create: `packages/schemas/src/__tests__/profile.test.ts`

- [ ] **Step 2.1 — Write `packages/schemas/src/profile.ts`**

```typescript
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
```

- [ ] **Step 2.2 — Add export to `packages/schemas/src/index.ts`**

Replace file content with:

```typescript
export * from './auth.js';
export * from './kyc.js';
export * from './profile.js';
```

- [ ] **Step 2.3 — Write `packages/schemas/src/__tests__/profile.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  UpdatePersonalSchema,
  UpdateEducationSchema,
  UpdateProfessionSchema,
  UpdateFamilySchema,
  UpdateLocationSchema,
  UpdateLifestyleSchema,
  UpdateHoroscopeSchema,
  UpdatePartnerPreferencesSchema,
  AddPhotoSchema,
} from '../profile.js';

describe('UpdatePersonalSchema', () => {
  it('accepts a valid partial personal update', () => {
    const result = UpdatePersonalSchema.safeParse({
      fullName: 'Priya Sharma',
      gender: 'FEMALE',
      height: 162,
      religion: 'Hindu',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object (all fields optional)', () => {
    expect(UpdatePersonalSchema.safeParse({}).success).toBe(true);
  });

  it('rejects height below 100 cm', () => {
    expect(UpdatePersonalSchema.safeParse({ height: 50 }).success).toBe(false);
  });

  it('rejects height above 250 cm', () => {
    expect(UpdatePersonalSchema.safeParse({ height: 300 }).success).toBe(false);
  });

  it('rejects invalid gender value', () => {
    expect(UpdatePersonalSchema.safeParse({ gender: 'ALIEN' }).success).toBe(false);
  });

  it('rejects invalid maritalStatus', () => {
    expect(UpdatePersonalSchema.safeParse({ maritalStatus: 'MARRIED' }).success).toBe(false);
  });

  it('accepts a valid datetime string for dob', () => {
    expect(UpdatePersonalSchema.safeParse({ dob: '1995-06-15T00:00:00.000Z' }).success).toBe(true);
  });

  it('rejects a non-datetime string for dob', () => {
    expect(UpdatePersonalSchema.safeParse({ dob: '15-06-1995' }).success).toBe(false);
  });
});

describe('UpdateEducationSchema', () => {
  it('accepts valid education data', () => {
    expect(UpdateEducationSchema.safeParse({
      degree: 'B.Tech',
      college: 'IIT Bombay',
      fieldOfStudy: 'Computer Science',
      year: 2018,
    }).success).toBe(true);
  });

  it('rejects year below 1950', () => {
    expect(UpdateEducationSchema.safeParse({ year: 1900 }).success).toBe(false);
  });

  it('rejects year above 2030', () => {
    expect(UpdateEducationSchema.safeParse({ year: 2050 }).success).toBe(false);
  });
});

describe('UpdateProfessionSchema', () => {
  it('accepts valid profession data', () => {
    expect(UpdateProfessionSchema.safeParse({
      occupation: 'Software Engineer',
      incomeRange: '15-25 LPA',
      workingAbroad: false,
    }).success).toBe(true);
  });
});

describe('UpdateFamilySchema', () => {
  it('accepts siblings array', () => {
    const result = UpdateFamilySchema.safeParse({
      familyType: 'JOINT',
      siblings: [{ name: 'Rahul', married: true, occupation: 'Doctor' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid familyType', () => {
    expect(UpdateFamilySchema.safeParse({ familyType: 'UNKNOWN' }).success).toBe(false);
  });
});

describe('UpdateLocationSchema', () => {
  it('accepts valid location', () => {
    expect(UpdateLocationSchema.safeParse({
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
    }).success).toBe(true);
  });

  it('rejects pincode longer than 10 chars', () => {
    expect(UpdateLocationSchema.safeParse({ pincode: '12345678901' }).success).toBe(false);
  });
});

describe('UpdateLifestyleSchema', () => {
  it('accepts valid lifestyle', () => {
    expect(UpdateLifestyleSchema.safeParse({
      diet: 'VEG',
      smoking: 'NEVER',
      hobbies: ['Reading', 'Travel'],
    }).success).toBe(true);
  });

  it('rejects invalid diet value', () => {
    expect(UpdateLifestyleSchema.safeParse({ diet: 'CARNIVORE' }).success).toBe(false);
  });
});

describe('UpdateHoroscopeSchema', () => {
  it('accepts valid horoscope', () => {
    expect(UpdateHoroscopeSchema.safeParse({
      rashi: 'Vrishabha',
      nakshatra: 'Rohini',
      tob: '06:30',
      pob: 'Pune',
    }).success).toBe(true);
  });

  it('rejects tob not in HH:MM format', () => {
    expect(UpdateHoroscopeSchema.safeParse({ tob: '6:30am' }).success).toBe(false);
  });

  it('rejects tob with seconds', () => {
    expect(UpdateHoroscopeSchema.safeParse({ tob: '06:30:00' }).success).toBe(false);
  });
});

describe('UpdatePartnerPreferencesSchema', () => {
  it('accepts valid partner preferences', () => {
    expect(UpdatePartnerPreferencesSchema.safeParse({
      ageRange: { min: 25, max: 32 },
      manglik: 'ANY',
      openToInterfaith: false,
    }).success).toBe(true);
  });

  it('rejects ageRange min below 18', () => {
    expect(UpdatePartnerPreferencesSchema.safeParse({
      ageRange: { min: 16, max: 30 },
    }).success).toBe(false);
  });

  it('rejects invalid manglik value', () => {
    expect(UpdatePartnerPreferencesSchema.safeParse({ manglik: 'MAYBE' }).success).toBe(false);
  });
});

describe('AddPhotoSchema', () => {
  it('accepts valid photo input', () => {
    expect(AddPhotoSchema.safeParse({ r2Key: 'profiles/abc.jpg', isPrimary: true }).success).toBe(true);
  });

  it('rejects empty r2Key', () => {
    expect(AddPhotoSchema.safeParse({ r2Key: '' }).success).toBe(false);
  });
});
```

- [ ] **Step 2.4 — Run the schema tests**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS/packages/schemas
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2.5 — Commit**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git add packages/schemas/src/profile.ts packages/schemas/src/index.ts packages/schemas/src/__tests__/profile.test.ts
git commit -m "feat(schemas): add profile Zod schemas with full validation"
```

---

## Task 3 — Profile Content Service

**Files:**
- Create: `apps/api/src/profiles/content.service.ts`

- [ ] **Step 3.1 — Write `apps/api/src/profiles/content.service.ts`**

```typescript
// apps/api/src/profiles/content.service.ts

import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type {
  ProfileContentResponse,
  PersonalSection,
  EducationSection,
  ProfessionSection,
  FamilySection,
  LocationSection,
  LifestyleSection,
  HoroscopeSection,
  PartnerPreferencesSection,
} from '@smartshaadi/types';

// All mutable section keys in the ProfileContent document
type ContentSection =
  | 'personal'
  | 'education'
  | 'profession'
  | 'family'
  | 'location'
  | 'lifestyle'
  | 'horoscope'
  | 'partnerPreferences';

/**
 * Upsert a named section on the ProfileContent document.
 * Creates the document if it doesn't exist yet (upsert: true).
 */
async function upsertSection(
  userId: string,
  section: ContentSection,
  data: object,
): Promise<ProfileContentResponse> {
  const doc = await ProfileContent.findOneAndUpdate(
    { userId },
    { $set: { [section]: data } },
    { new: true, upsert: true, lean: true },
  );
  // lean() returns a plain JS object; cast to our response type
  return doc as unknown as ProfileContentResponse;
}

/** Fetch the full ProfileContent document for a user. Returns null if not yet created. */
export async function getMyProfileContent(
  userId: string,
): Promise<ProfileContentResponse | null> {
  const doc = await ProfileContent.findOne({ userId }).lean();
  return doc ? (doc as unknown as ProfileContentResponse) : null;
}

export async function updatePersonal(
  userId: string,
  data: PersonalSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'personal', data);
}

export async function updateEducation(
  userId: string,
  data: EducationSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'education', data);
}

export async function updateProfession(
  userId: string,
  data: ProfessionSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'profession', data);
}

export async function updateFamily(
  userId: string,
  data: FamilySection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'family', data);
}

export async function updateLocation(
  userId: string,
  data: LocationSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'location', data);
}

export async function updateLifestyle(
  userId: string,
  data: LifestyleSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'lifestyle', data);
}

export async function updateHoroscope(
  userId: string,
  data: HoroscopeSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'horoscope', data);
}

export async function updatePartnerPreferences(
  userId: string,
  data: PartnerPreferencesSection,
): Promise<ProfileContentResponse> {
  return upsertSection(userId, 'partnerPreferences', data);
}
```

- [ ] **Step 3.2 — Commit**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git add apps/api/src/profiles/content.service.ts
git commit -m "feat(api): add profile content service (MongoDB upsert per section)"
```

---

## Task 4 — Profile Content Router + Mount

**Files:**
- Create: `apps/api/src/profiles/content.router.ts`
- Modify: `apps/api/src/profiles/router.ts` (add one `use` call before `/:id`)

- [ ] **Step 4.1 — Write `apps/api/src/profiles/content.router.ts`**

```typescript
// apps/api/src/profiles/content.router.ts

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  UpdatePersonalSchema,
  UpdateEducationSchema,
  UpdateProfessionSchema,
  UpdateFamilySchema,
  UpdateLocationSchema,
  UpdateLifestyleSchema,
  UpdateHoroscopeSchema,
  UpdatePartnerPreferencesSchema,
} from '@smartshaadi/schemas';
import {
  getMyProfileContent,
  updatePersonal,
  updateEducation,
  updateProfession,
  updateFamily,
  updateLocation,
  updateLifestyle,
  updateHoroscope,
  updatePartnerPreferences,
} from './content.service.js';

export const profileContentRouter = Router();

/**
 * GET /api/v1/profiles/me/content
 * Returns the full MongoDB ProfileContent document.
 * Returns { success: true, data: null } if the user hasn't filled any content yet.
 */
profileContentRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const content = await getMyProfileContent(req.user!.id);
    ok(res, content); // null is a valid response — content not yet created
  },
);

/**
 * PUT /api/v1/profiles/me/content/personal
 * Updates the personal section (name, DOB, gender, religion, etc.)
 */
profileContentRouter.put(
  '/personal',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdatePersonalSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updatePersonal(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/education
 */
profileContentRouter.put(
  '/education',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateEducationSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateEducation(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/profession
 */
profileContentRouter.put(
  '/profession',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateProfessionSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateProfession(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/family
 */
profileContentRouter.put(
  '/family',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateFamilySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateFamily(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/location
 */
profileContentRouter.put(
  '/location',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateLocation(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/lifestyle
 */
profileContentRouter.put(
  '/lifestyle',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateLifestyleSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateLifestyle(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/horoscope
 */
profileContentRouter.put(
  '/horoscope',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateHoroscopeSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateHoroscope(req.user!.id, parsed.data);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/partner-preferences
 */
profileContentRouter.put(
  '/partner-preferences',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdatePartnerPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updatePartnerPreferences(req.user!.id, parsed.data);
    ok(res, content);
  },
);
```

- [ ] **Step 4.2 — Mount content router in `apps/api/src/profiles/router.ts`**

Add the following import at the top of the file (after existing imports):

```typescript
import { profileContentRouter } from './content.router.js';
```

Then add this line **before** the `profilesRouter.get('/:id', ...)` route handler (before line 113):

```typescript
// Mount content sub-router — MUST be before /:id to prevent route conflict
profilesRouter.use('/me/content', profileContentRouter);
```

The final order in `router.ts` must be:
1. `GET /me`
2. `PUT /me`
3. `POST /me/photos`
4. `DELETE /me/photos/:photoId`
5. `use /me/content` ← new
6. `GET /:id`

- [ ] **Step 4.3 — Type-check the API**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS/apps/api
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4.4 — Commit**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git add apps/api/src/profiles/content.router.ts apps/api/src/profiles/router.ts
git commit -m "feat(api): add profile content sub-endpoints (GET + 8 PUT)"
```

---

## Task 5 — Fix Photo Bug + Extend Wizard

**Files:**
- Modify: `apps/web/src/app/(profile)/create/page.tsx`

The wizard changes:
- **New Step 1** — Personal basics: full name, DOB, gender, marital status, city, religion. Posts to `PUT /api/v1/profiles/me/content/personal`.
- **Step 2** — Living preferences (was Step 1, unchanged).
- **Step 3** — Safety Mode info (was Step 2, unchanged).
- **Step 4** — Photo upload (was Step 3). **Bug fix:** after R2 upload succeeds, call `POST /api/v1/profiles/me/photos` with `r2Key` and `isPrimary: true`.

- [ ] **Step 5.1 — Replace `apps/web/src/app/(profile)/create/page.tsx`**

```typescript
'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

type StayQuotient = 'INDEPENDENT' | 'WITH_PARENTS' | 'WITH_INLAWS' | 'FLEXIBLE';
type Gender       = 'MALE' | 'FEMALE' | 'OTHER';
type MaritalStatus = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface PersonalFields {
  fullName:      string;
  dob:           string;           // YYYY-MM-DD
  gender:        Gender | '';
  maritalStatus: MaritalStatus | '';
  city:          string;
  religion:      string;
}

interface PreferenceFields {
  stayQuotient:            StayQuotient | '';
  familyInclinationScore:  string;
  functionAttendanceScore: string;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Personal' },
    { n: 2, label: 'Preferences' },
    { n: 3, label: 'Safety' },
    { n: 4, label: 'Photos' },
  ];

  return (
    <div className="flex items-center gap-0 w-full max-w-sm mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                current === s.n
                  ? 'bg-[#0E7C7B] text-white'
                  : current > s.n
                  ? 'bg-[#059669] text-white'
                  : 'bg-white border-2 border-[#CBD5E1] text-[#64748B]'
              }`}
            >
              {current > s.n ? '✓' : s.n}
            </div>
            <span
              className={`text-xs mt-1 ${
                current >= s.n ? 'text-[#0A1F4D] font-medium' : 'text-[#64748B]'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 flex-1 mb-4 transition-colors ${
                current > s.n ? 'bg-[#059669]' : 'bg-[#CBD5E1]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 — Personal basics ──────────────────────────────────────────────────

function Step1({
  fields,
  onChange,
  onNext,
}: {
  fields: PersonalFields;
  onChange: (f: Partial<PersonalFields>) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'MALE',   label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER',  label: 'Other' },
  ];

  const maritalOptions: { value: MaritalStatus; label: string }[] = [
    { value: 'NEVER_MARRIED', label: 'Never married' },
    { value: 'DIVORCED',      label: 'Divorced' },
    { value: 'WIDOWED',       label: 'Widowed' },
    { value: 'SEPARATED',     label: 'Separated' },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fields.fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!fields.dob) {
      setError('Please enter your date of birth');
      return;
    }
    if (!fields.gender) {
      setError('Please select your gender');
      return;
    }
    if (!fields.maritalStatus) {
      setError('Please select your marital status');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/profiles/me/content/personal`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fullName:      fields.fullName.trim(),
            dob:           new Date(fields.dob).toISOString(),
            gender:        fields.gender,
            maritalStatus: fields.maritalStatus,
            ...(fields.city.trim()     && { city: fields.city.trim() }),
            ...(fields.religion.trim() && { religion: fields.religion.trim() }),
          }),
        },
      );
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) {
        setError(json.error?.message ?? 'Failed to save personal details');
        setLoading(false);
        return;
      }
      onNext();
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          About you
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Tell us a little about yourself</p>
      </div>

      {/* Full name */}
      <div className="space-y-1">
        <label htmlFor="fullName" className="block text-sm font-medium text-[#0F172A]">Full name</label>
        <input
          id="fullName"
          type="text"
          value={fields.fullName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ fullName: e.target.value })}
          placeholder="e.g. Priya Sharma"
          className="w-full min-h-[44px] rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40"
        />
      </div>

      {/* Date of birth */}
      <div className="space-y-1">
        <label htmlFor="dob" className="block text-sm font-medium text-[#0F172A]">Date of birth</label>
        <input
          id="dob"
          type="date"
          value={fields.dob}
          max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ dob: e.target.value })}
          className="w-full min-h-[44px] rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40"
        />
      </div>

      {/* Gender */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-[#0F172A]">Gender</label>
        <div className="grid grid-cols-3 gap-2">
          {genderOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ gender: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.gender === opt.value
                  ? 'border-[#0E7C7B] bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#0E7C7B]/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Marital status */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-[#0F172A]">Marital status</label>
        <div className="grid grid-cols-2 gap-2">
          {maritalOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ maritalStatus: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.maritalStatus === opt.value
                  ? 'border-[#0E7C7B] bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#0E7C7B]/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* City (optional) */}
      <div className="space-y-1">
        <label htmlFor="city" className="block text-sm font-medium text-[#0F172A]">
          City <span className="text-[#64748B] font-normal">(optional)</span>
        </label>
        <input
          id="city"
          type="text"
          value={fields.city}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ city: e.target.value })}
          placeholder="e.g. Mumbai"
          className="w-full min-h-[44px] rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40"
        />
      </div>

      {/* Religion (optional) */}
      <div className="space-y-1">
        <label htmlFor="religion" className="block text-sm font-medium text-[#0F172A]">
          Religion <span className="text-[#64748B] font-normal">(optional)</span>
        </label>
        <input
          id="religion"
          type="text"
          value={fields.religion}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ religion: e.target.value })}
          placeholder="e.g. Hindu"
          className="w-full min-h-[44px] rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );
}

// ── Step 2 — Living preferences ───────────────────────────────────────────────

function Step2({
  fields,
  onChange,
  onNext,
}: {
  fields: PreferenceFields;
  onChange: (f: Partial<PreferenceFields>) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const familyScore   = parseInt(fields.familyInclinationScore,  10);
    const functionScore = parseInt(fields.functionAttendanceScore, 10);

    if (fields.stayQuotient === '') {
      setError('Please select a living arrangement preference');
      return;
    }
    if (isNaN(familyScore) || familyScore < 0 || familyScore > 100) {
      setError('Family inclination score must be between 0 and 100');
      return;
    }
    if (isNaN(functionScore) || functionScore < 0 || functionScore > 100) {
      setError('Function attendance score must be between 0 and 100');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/profiles/me`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            stayQuotient:            fields.stayQuotient,
            familyInclinationScore:  familyScore,
            functionAttendanceScore: functionScore,
          }),
        },
      );
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) {
        setError(json.error?.message ?? 'Failed to save preferences');
        setLoading(false);
        return;
      }
      onNext();
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  const stayOptions: { value: StayQuotient; label: string }[] = [
    { value: 'INDEPENDENT',   label: 'Independent' },
    { value: 'WITH_PARENTS',  label: 'With parents' },
    { value: 'WITH_INLAWS',   label: 'With in-laws' },
    { value: 'FLEXIBLE',      label: 'Flexible' },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Your preferences
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Help us find your best match</p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-[#0F172A]">Living arrangement</label>
        <div className="grid grid-cols-2 gap-2">
          {stayOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ stayQuotient: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.stayQuotient === opt.value
                  ? 'border-[#0E7C7B] bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#0E7C7B]/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="familyScore" className="block text-sm font-medium text-[#0F172A]">
          Family inclination
          <span className="ml-2 text-xs text-[#64748B]">({fields.familyInclinationScore || '—'}/100)</span>
        </label>
        <input
          id="familyScore"
          type="range"
          min={0}
          max={100}
          step={5}
          value={fields.familyInclinationScore || '50'}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ familyInclinationScore: e.target.value })
          }
          className="w-full accent-[#0E7C7B]"
        />
        <div className="flex justify-between text-xs text-[#64748B]">
          <span>Independent</span>
          <span>Family-oriented</span>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="functionScore" className="block text-sm font-medium text-[#0F172A]">
          Function attendance
          <span className="ml-2 text-xs text-[#64748B]">({fields.functionAttendanceScore || '—'}/100)</span>
        </label>
        <input
          id="functionScore"
          type="range"
          min={0}
          max={100}
          step={5}
          value={fields.functionAttendanceScore || '50'}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ functionAttendanceScore: e.target.value })
          }
          className="w-full accent-[#0E7C7B]"
        />
        <div className="flex justify-between text-xs text-[#64748B]">
          <span>Rarely attend</span>
          <span>Always attend</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );
}

// ── Step 3 — Safety Mode info ─────────────────────────────────────────────────

function Step3({ onNext }: { onNext: () => void }) {
  return (
    <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Safety Mode
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Your privacy, your control</p>
      </div>

      <div className="rounded-lg bg-[#0E7C7B]/8 border border-[#0E7C7B]/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-[#0E7C7B] text-lg mt-0.5">&#128274;</span>
          <div>
            <p className="text-sm font-medium text-[#0A1F4D]">Contact details protected</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Your phone number and email are hidden from other users by default. Only share contact
              details when you choose to unlock them for a specific match.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-[#059669] text-lg mt-0.5">&#9989;</span>
          <div>
            <p className="text-sm font-medium text-[#0A1F4D]">Safety Mode is always active</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Contact unlock controls will be available once your profile is verified by our KYC team.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] text-white text-sm font-medium transition-colors"
      >
        Understood, continue
      </button>
    </div>
  );
}

// ── Step 4 — Photo upload (bug-fixed) ─────────────────────────────────────────

function Step4({ onDone }: { onDone: () => void }) {
  const [file,       setFile]       = useState<File | null>(null);
  const [preview,    setPreview]    = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setError(null);
  }

  async function handleUpload() {
    if (!file) { setError('Please select a photo first'); return; }
    setError(null);
    setUploading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

      // 1 — Get pre-signed URL
      const presignRes = await fetch(`${apiBase}/api/v1/storage/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: 'profiles' }),
      });
      const presignJson = (await presignRes.json()) as {
        success: boolean;
        data?: { uploadUrl: string; r2Key: string };
        error?: { message?: string };
      };
      if (!presignJson.success || !presignJson.data) {
        setError(presignJson.error?.message ?? 'Failed to get upload URL');
        setUploading(false);
        return;
      }

      // 2 — Upload directly to R2
      const r2Res = await fetch(presignJson.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!r2Res.ok) {
        setError('Upload failed — please try again');
        setUploading(false);
        return;
      }

      // 3 — Register the photo in the database (bug fix)
      const registerRes = await fetch(`${apiBase}/api/v1/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ r2Key: presignJson.data.r2Key, isPrimary: true, displayOrder: 0 }),
      });
      const registerJson = (await registerRes.json()) as { success: boolean; error?: { message?: string } };
      if (!registerJson.success) {
        setError(registerJson.error?.message ?? 'Photo uploaded but failed to register');
        setUploading(false);
        return;
      }

      setUploadDone(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Profile photo
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Add a clear photo to improve match quality</p>
      </div>

      <label
        htmlFor="photo-upload"
        className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-[160px] ${
          preview
            ? 'border-[#0E7C7B] bg-[#0E7C7B]/5'
            : 'border-[#CBD5E1] bg-[#F8F9FC] hover:border-[#0E7C7B]/40'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-3xl">&#128247;</span>
            <p className="text-sm text-[#64748B] text-center">
              Tap to select a photo
              <br />
              <span className="text-xs">JPEG · PNG · WebP</span>
            </p>
          </div>
        )}
        <input
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {uploadDone ? (
        <div className="rounded-lg bg-[#059669]/10 border border-[#059669]/20 p-3 text-center">
          <p className="text-sm font-medium text-[#059669]">Photo uploaded successfully!</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Uploading…
            </>
          ) : (
            'Upload photo'
          )}
        </button>
      )}

      <button
        type="button"
        onClick={onDone}
        className={`w-full min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
          uploadDone
            ? 'border-[#0E7C7B] bg-[#0E7C7B] text-white hover:bg-[#149998]'
            : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0E7C7B]/40'
        }`}
      >
        {uploadDone ? 'View my profile' : 'Skip for now'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreateProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [personal, setPersonal] = useState<PersonalFields>({
    fullName:      '',
    dob:           '',
    gender:        '',
    maritalStatus: '',
    city:          '',
    religion:      '',
  });

  const [preferences, setPreferences] = useState<PreferenceFields>({
    stayQuotient:            '',
    familyInclinationScore:  '50',
    functionAttendanceScore: '50',
  });

  function updatePersonal(partial: Partial<PersonalFields>) {
    setPersonal((prev) => ({ ...prev, ...partial }));
  }

  function updatePreferences(partial: Partial<PreferenceFields>) {
    setPreferences((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="flex flex-col items-center w-full">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1 fields={personal} onChange={updatePersonal} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <Step2 fields={preferences} onChange={updatePreferences} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <Step3 onNext={() => setStep(4)} />
      )}
      {step === 4 && (
        <Step4 onDone={() => router.push('/')} />
      )}
    </div>
  );
}
```

- [ ] **Step 5.2 — Type-check the web app**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS/apps/web
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5.3 — Commit**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git add apps/web/src/app/\(profile\)/create/page.tsx
git commit -m "feat(web): extend profile wizard to 4 steps, fix photo registration bug"
```

---

## Task 6 — Full Monorepo Type-Check + Final Commit

- [ ] **Step 6.1 — Run type-check across all packages**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
pnpm type-check
```

Expected: clean exit (no errors).

- [ ] **Step 6.2 — Run all tests**

```bash
pnpm test
```

Expected: packages/types and packages/schemas tests all pass.

- [ ] **Step 6.3 — Update ROADMAP.md**

In `ROADMAP.md`, mark the following as done under Week 1 / Phase 1:
- Profile schemas (`packages/schemas`) — complete
- Profile TypeScript types (`packages/types`) — complete
- Profile content sub-endpoints (`/me/content/*`) — complete
- Profile wizard extended to 4 steps — complete
- Photo registration bug fixed — complete

---

## Self-Review

**Spec coverage check:**
- ✅ Bug fix (photo registration) — Task 5, Step 4 section
- ✅ `packages/schemas/src/profile.ts` — Task 2
- ✅ `packages/types/src/profile.ts` — Task 1
- ✅ `GET /me/content` — Task 4
- ✅ `PUT /me/content/personal` — Task 4
- ✅ `PUT /me/content/education` — Task 4
- ✅ `PUT /me/content/profession` — Task 4
- ✅ `PUT /me/content/family` — Task 4
- ✅ `PUT /me/content/location` — Task 4
- ✅ `PUT /me/content/lifestyle` — Task 4
- ✅ `PUT /me/content/horoscope` — Task 4
- ✅ `PUT /me/content/partner-preferences` — Task 4
- ✅ Wizard Step 1 (personal basics) — Task 5
- ✅ Router mount ordering (before `/:id`) — Task 4, Step 4.2

**Type consistency check:**
- `ProfileContentResponse` defined in `packages/types/src/profile.ts` and imported by `content.service.ts` via `@smartshaadi/types` ✅
- `Update*Schema` exported from `packages/schemas/src/profile.ts`, imported by `content.router.ts` via `@smartshaadi/schemas` ✅
- Service function names match router imports exactly ✅

**No placeholders:** All steps contain complete code. No TBDs. ✅
