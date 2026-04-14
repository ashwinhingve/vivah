// apps/api/src/profiles/content.router.ts

import { Router, type Request, type Response } from 'express';
import type {
  PersonalSection,
  EducationSection,
  ProfessionSection,
  FamilySection,
  LocationSection,
  LifestyleSection,
  HoroscopeSection,
  PartnerPreferencesSection,
} from '@smartshaadi/types';
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
  ProfileBulkUpdateSchema,
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
  bulkUpdateContent,
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

    // Build clean input by stripping undefined values to satisfy exactOptionalPropertyTypes
    const input: PersonalSection = {};
    if (parsed.data.fullName != null) input.fullName = parsed.data.fullName;
    if (parsed.data.dob != null) input.dob = parsed.data.dob;
    if (parsed.data.gender != null) input.gender = parsed.data.gender;
    if (parsed.data.height != null) input.height = parsed.data.height;
    if (parsed.data.weight != null) input.weight = parsed.data.weight;
    if (parsed.data.maritalStatus != null) input.maritalStatus = parsed.data.maritalStatus;
    if (parsed.data.motherTongue != null) input.motherTongue = parsed.data.motherTongue;
    if (parsed.data.religion != null) input.religion = parsed.data.religion;
    if (parsed.data.caste != null) input.caste = parsed.data.caste;
    if (parsed.data.subCaste != null) input.subCaste = parsed.data.subCaste;
    if (parsed.data.manglik != null) input.manglik = parsed.data.manglik;
    if (parsed.data.gotra != null) input.gotra = parsed.data.gotra;

    const content = await updatePersonal(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: EducationSection = {};
    if (parsed.data.degree != null) input.degree = parsed.data.degree;
    if (parsed.data.college != null) input.college = parsed.data.college;
    if (parsed.data.fieldOfStudy != null) input.fieldOfStudy = parsed.data.fieldOfStudy;
    if (parsed.data.year != null) input.year = parsed.data.year;
    if (parsed.data.additionalDegrees != null) {
      input.additionalDegrees = parsed.data.additionalDegrees.map((d) => {
        const cleanDeg: import('@smartshaadi/types').AdditionalDegreeEntry = {};
        if (d.degree != null) cleanDeg.degree = d.degree;
        if (d.college != null) cleanDeg.college = d.college;
        if (d.year != null) cleanDeg.year = d.year;
        return cleanDeg;
      });
    }

    const content = await updateEducation(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: ProfessionSection = {};
    if (parsed.data.occupation != null) input.occupation = parsed.data.occupation;
    if (parsed.data.employer != null) input.employer = parsed.data.employer;
    if (parsed.data.incomeRange != null) input.incomeRange = parsed.data.incomeRange;
    if (parsed.data.workLocation != null) input.workLocation = parsed.data.workLocation;
    if (parsed.data.workingAbroad != null) input.workingAbroad = parsed.data.workingAbroad;
    if (parsed.data.employerType != null) input.employerType = parsed.data.employerType;
    if (parsed.data.designation != null) input.designation = parsed.data.designation;
    if (parsed.data.abroadCountry != null) input.abroadCountry = parsed.data.abroadCountry;

    const content = await updateProfession(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: FamilySection = {};
    if (parsed.data.fatherName != null) input.fatherName = parsed.data.fatherName;
    if (parsed.data.fatherOccupation != null) input.fatherOccupation = parsed.data.fatherOccupation;
    if (parsed.data.motherName != null) input.motherName = parsed.data.motherName;
    if (parsed.data.motherOccupation != null) input.motherOccupation = parsed.data.motherOccupation;
    if (parsed.data.siblings != null) {
      input.siblings = parsed.data.siblings.map((sib) => {
        const cleanSib: import('@smartshaadi/types').SiblingEntry = {};
        if (sib.name != null) cleanSib.name = sib.name;
        if (sib.married != null) cleanSib.married = sib.married;
        if (sib.occupation != null) cleanSib.occupation = sib.occupation;
        return cleanSib;
      });
    }
    if (parsed.data.familyType != null) input.familyType = parsed.data.familyType;
    if (parsed.data.familyValues != null) input.familyValues = parsed.data.familyValues;
    if (parsed.data.familyStatus != null) input.familyStatus = parsed.data.familyStatus;
    if (parsed.data.nativePlace != null) input.nativePlace = parsed.data.nativePlace;
    if (parsed.data.familyAbout != null) input.familyAbout = parsed.data.familyAbout;

    const content = await updateFamily(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: LocationSection = {};
    if (parsed.data.city != null) input.city = parsed.data.city;
    if (parsed.data.state != null) input.state = parsed.data.state;
    if (parsed.data.country != null) input.country = parsed.data.country;
    if (parsed.data.pincode != null) input.pincode = parsed.data.pincode;

    const content = await updateLocation(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: LifestyleSection = {};
    if (parsed.data.diet != null) input.diet = parsed.data.diet;
    if (parsed.data.smoking != null) input.smoking = parsed.data.smoking;
    if (parsed.data.drinking != null) input.drinking = parsed.data.drinking;
    if (parsed.data.hobbies != null) input.hobbies = parsed.data.hobbies;
    if (parsed.data.interests != null) input.interests = parsed.data.interests;
    if (parsed.data.hyperNicheTags != null) input.hyperNicheTags = [...parsed.data.hyperNicheTags];
    if (parsed.data.languagesSpoken != null) input.languagesSpoken = parsed.data.languagesSpoken;
    if (parsed.data.ownHouse != null) input.ownHouse = parsed.data.ownHouse;
    if (parsed.data.ownCar != null) input.ownCar = parsed.data.ownCar;
    if (parsed.data.fitnessLevel != null) input.fitnessLevel = parsed.data.fitnessLevel;
    if (parsed.data.sunSign != null) input.sunSign = parsed.data.sunSign;

    const content = await updateLifestyle(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: HoroscopeSection = {};
    if (parsed.data.dob != null) input.dob = parsed.data.dob;
    if (parsed.data.manglik != null) input.manglik = parsed.data.manglik;
    if (parsed.data.rashi != null) input.rashi = parsed.data.rashi;
    if (parsed.data.nakshatra != null) input.nakshatra = parsed.data.nakshatra;
    if (parsed.data.tob != null) input.tob = parsed.data.tob;
    if (parsed.data.pob != null) input.pob = parsed.data.pob;

    const content = await updateHoroscope(req.user!.id, input);
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

    // Build clean input by stripping undefined values
    const input: PartnerPreferencesSection = {};
    if (parsed.data.ageRange != null) input.ageRange = parsed.data.ageRange;
    if (parsed.data.heightRange != null) input.heightRange = parsed.data.heightRange;
    if (parsed.data.incomeRange != null) input.incomeRange = parsed.data.incomeRange;
    if (parsed.data.education != null) input.education = parsed.data.education;
    if (parsed.data.religion != null) input.religion = parsed.data.religion;
    if (parsed.data.caste != null) input.caste = parsed.data.caste;
    if (parsed.data.location != null) input.location = parsed.data.location;
    if (parsed.data.manglik != null) input.manglik = parsed.data.manglik;
    if (parsed.data.diet != null) input.diet = parsed.data.diet;
    if (parsed.data.openToInterfaith != null) input.openToInterfaith = parsed.data.openToInterfaith;
    if (parsed.data.openToInterCaste != null) input.openToInterCaste = parsed.data.openToInterCaste;

    const content = await updatePartnerPreferences(req.user!.id, input);
    ok(res, content);
  },
);

/**
 * PUT /api/v1/profiles/me/content/bulk
 * Bulk update multiple sections and recompute profile completeness.
 * Returns the full ProfileContentResponse plus completenessScore.
 */
profileContentRouter.put(
  '/bulk',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ProfileBulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    const result = await bulkUpdateContent(req.user!.id, parsed.data);
    ok(res, result);
  },
);
