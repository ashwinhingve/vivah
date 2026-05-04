import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Model } from 'mongoose';

vi.mock('../../lib/env.js', () => ({ env: { USE_MOCK_SERVICES: false } }));

vi.mock('../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {} as unknown as Model<{ userId: string; [key: string]: unknown }>,
}));

vi.mock('../../lib/db.js', () => {
  const chain = () => ({
    from:     vi.fn().mockReturnThis(),
    where:    vi.fn().mockReturnThis(),
    limit:    vi.fn().mockResolvedValue([]),
    select:   vi.fn().mockReturnThis(),
    values:   vi.fn().mockResolvedValue([]),
    set:      vi.fn().mockReturnThis(),
    insert:   vi.fn().mockResolvedValue([]),
    update:   vi.fn().mockResolvedValue([]),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  });
  return {
    db: {
      select: vi.fn(chain),
      insert: vi.fn(chain),
      update: vi.fn(chain),
    },
  };
});

import { ProfileContent } from '../../infrastructure/mongo/models/ProfileContent.js';
import { db } from '../../lib/db.js';
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
  computeAndUpdateCompleteness,
  bulkUpdateContent,
} from '../content.service.js';

const mockUserId = 'user-uuid-1';
const mockProfileId = 'profile-uuid-1';

const mockProfileContent = {
  userId: mockUserId,
  personal: {
    fullName: 'Priya Sharma',
    dob: new Date('1995-06-15'),
    gender: 'FEMALE',
  },
  education: {
    degree: 'B.Tech',
    college: 'IIT Bombay',
  },
  profession: {
    occupation: 'Software Engineer',
  },
  family: {
    familyType: 'NUCLEAR',
  },
  lifestyle: {
    diet: 'VEG',
    smoking: 'NEVER',
    drinking: 'NEVER',
  },
  horoscope: {
    rashi: 'Vrishabha',
    nakshatra: 'Rohini',
  },
  partnerPreferences: {
    ageRange: { min: 25, max: 32 },
  },
};

function setupSelectReturns(...results: unknown[][]) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const returnValue = results[call] ?? [];
    call++;
    // Chain is thenable so `await db.select().from().where()` resolves even without .limit()
    const c: Record<string, unknown> = {
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue(returnValue),
      select: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(returnValue).then(resolve, reject),
    };
    return c as unknown as ReturnType<typeof db.select>;
  });
}

function setupUpdateOk() {
  vi.mocked(db.update).mockImplementation((() => {
    const c = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    return c as unknown as ReturnType<typeof db.update>;
  }) as typeof db.update);
}

function setupInsertOk() {
  vi.mocked(db.insert).mockImplementation((() => {
    const c = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    };
    return c as unknown as ReturnType<typeof db.insert>;
  }) as typeof db.insert);
}

function setupProfileContentFindOne(doc: unknown) {
  const mockModel = ProfileContent as unknown as {
    findOneAndUpdate?: ReturnType<typeof vi.fn>;
    findOne?: ReturnType<typeof vi.fn>;
  };
  if (!mockModel.findOne) {
    mockModel.findOne = vi.fn();
  }
  if (typeof mockModel.findOne === 'object') {
    mockModel.findOne = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(doc),
    });
  } else {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      lean: vi.fn().mockResolvedValue(doc),
    });
  }
}

function setupProfileContentFindOneAndUpdate(doc: unknown) {
  const mockModel = ProfileContent as unknown as {
    findOneAndUpdate?: ReturnType<typeof vi.fn>;
    findOne?: ReturnType<typeof vi.fn>;
  };
  if (!mockModel.findOneAndUpdate) {
    mockModel.findOneAndUpdate = vi.fn();
  }
  if (typeof mockModel.findOneAndUpdate === 'object') {
    mockModel.findOneAndUpdate = vi.fn().mockResolvedValue(doc);
  } else {
    (mockModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(doc);
  }
}

beforeEach(() => vi.clearAllMocks());

// ── getMyProfileContent ───────────────────────────────────────────────────────

describe('getMyProfileContent', () => {
  it('returns the full ProfileContent document when it exists', async () => {
    setupProfileContentFindOne(mockProfileContent);
    const result = await getMyProfileContent(mockUserId);
    expect(result).toEqual(mockProfileContent);
  });

  it('returns null when no ProfileContent document exists', async () => {
    setupProfileContentFindOne(null);
    const result = await getMyProfileContent(mockUserId);
    expect(result).toBeNull();
  });
});

// ── updatePersonal ────────────────────────────────────────────────────────────

describe('updatePersonal', () => {
  it('upserts the personal section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const personalData = {
      fullName: 'Priya Sharma',
      dob: new Date('1995-06-15'),
      gender: 'FEMALE' as const,
    };
    const result = await updatePersonal(mockUserId, personalData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updateEducation ──────────────────────────────────────────────────────────

describe('updateEducation', () => {
  it('upserts the education section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const eduData = {
      degree: 'B.Tech',
      college: 'IIT Bombay',
      fieldOfStudy: 'Computer Science',
      year: 2018,
    };
    const result = await updateEducation(mockUserId, eduData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updateProfession ─────────────────────────────────────────────────────────

describe('updateProfession', () => {
  it('upserts the profession section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const profData = {
      occupation: 'Software Engineer',
      incomeRange: '15-25 LPA',
      workingAbroad: false,
    };
    const result = await updateProfession(mockUserId, profData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updateFamily ──────────────────────────────────────────────────────────────

describe('updateFamily', () => {
  it('upserts the family section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const familyData = {
      familyType: 'NUCLEAR' as const,
      familyValues: 'TRADITIONAL' as const,
    };
    const result = await updateFamily(mockUserId, familyData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updateLocation ────────────────────────────────────────────────────────────

describe('updateLocation', () => {
  it('upserts the location section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const locData = {
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
    };
    const result = await updateLocation(mockUserId, locData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updateLifestyle ──────────────────────────────────────────────────────────

describe('updateLifestyle', () => {
  it('upserts the lifestyle section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const lifeData = {
      diet: 'VEG' as const,
      smoking: 'NEVER' as const,
      drinking: 'NEVER' as const,
      hobbies: ['Reading', 'Travel'],
    };
    const result = await updateLifestyle(mockUserId, lifeData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updateHoroscope ──────────────────────────────────────────────────────────

describe('updateHoroscope', () => {
  it('upserts the horoscope section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const horoData = {
      rashi: 'Vrishabha',
      nakshatra: 'Rohini',
      tob: '06:30',
      pob: 'Pune',
    };
    const result = await updateHoroscope(mockUserId, horoData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── updatePartnerPreferences ──────────────────────────────────────────────────

describe('updatePartnerPreferences', () => {
  it('upserts the partnerPreferences section', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    const prefData = {
      ageRange: { min: 25, max: 32 },
      manglik: 'ANY' as const,
      openToInterfaith: false,
    };
    const result = await updatePartnerPreferences(mockUserId, prefData as any);
    expect(result).toEqual(mockProfileContent);
  });
});

// ── computeAndUpdateCompleteness ──────────────────────────────────────────────

describe('computeAndUpdateCompleteness', () => {
  it('returns 0 when no profile exists in MongoDB', async () => {
    setupProfileContentFindOne(null);
    setupSelectReturns([]);
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(0);
  });

  it('returns 0 when no PostgreSQL profile row found', async () => {
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([]);  // profiles select returns empty → early return 0
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(0);
  });

  it('computes score correctly when only personal is filled', async () => {
    const doc = {
      userId: mockUserId,
      personal: {
        fullName: 'Test',
        dob: new Date(),
        gender: 'MALE',
      },
    };
    setupProfileContentFindOne(doc);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);  // profiles, profilePhotos count
    setupInsertOk();
    setupUpdateOk();
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(15);  // personal=15
  });

  it('computes score correctly when personal, family, and career are filled', async () => {
    const doc = {
      userId: mockUserId,
      personal: { fullName: 'Test', dob: new Date(), gender: 'MALE' },
      family: { familyType: 'NUCLEAR' },
      education: { degree: 'B.Tech' },
      profession: { occupation: 'Engineer' },
    };
    setupProfileContentFindOne(doc);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(15 + 10 + 15);  // personal + family + career = 40
  });

  it('computes score correctly when all sections are filled', async () => {
    const doc = {
      userId: mockUserId,
      personal: { fullName: 'Test', dob: new Date(), gender: 'MALE' },
      family: { familyType: 'NUCLEAR' },
      education: { degree: 'B.Tech' },
      profession: { occupation: 'Engineer' },
      lifestyle: { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER' },
      horoscope: { rashi: 'Aries' },
      partnerPreferences: { ageRange: { min: 25, max: 30 } },
      personalityScores: { openness: 0.7, conscientiousness: 0.8, extraversion: 0.5, agreeableness: 0.6, neuroticism: 0.3 },
    };
    setupProfileContentFindOne(doc);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 1 }]);
    setupInsertOk();
    setupUpdateOk();
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(15 + 20 + 10 + 15 + 10 + 10 + 10 + 10);  // All sections + photos = 100
  });

  it('preserves existing photos value when recomputing', async () => {
    const doc = {
      userId: mockUserId,
      personal: { fullName: 'Test', dob: new Date(), gender: 'MALE' },
    };
    setupProfileContentFindOne(doc);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 1 }]);
    setupInsertOk();
    setupUpdateOk();
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(15 + 20);  // personal + photos = 35
  });

  it('counts personality complete when personalityScores has any keys', async () => {
    const doc = {
      userId: mockUserId,
      personalityScores: { openness: 0.7 },
    };
    setupProfileContentFindOne(doc);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const score = await computeAndUpdateCompleteness(mockUserId);
    expect(score).toBe(10);  // personality only
  });

  it('updates both profileSections and profiles table', async () => {
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    await computeAndUpdateCompleteness(mockUserId);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

// ── bulkUpdateContent ─────────────────────────────────────────────────────────

describe('bulkUpdateContent', () => {
  it('updates family section and recomputes completeness', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      family: { familyType: 'NUCLEAR' },
    });
    expect(result.completenessScore).toBeDefined();
    expect(result.userId).toBe(mockUserId);
  });

  it('updates education section and recomputes completeness', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      education: { degree: 'MBA', college: 'XLRI', year: 2020 },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('updates profession section and recomputes completeness', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      profession: { occupation: 'Manager', incomeRange: '20-30 LPA' },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('updates lifestyle section and recomputes completeness', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      lifestyle: { diet: 'JAIN', smoking: 'NEVER' },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('updates multiple sections at once', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      family: { familyType: 'JOINT', familyValues: 'TRADITIONAL' },
      lifestyle: { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER' },
      education: { degree: 'B.Tech', college: 'IIT Bombay', year: 2020 },
    });
    expect(result.completenessScore).toBeDefined();
    expect(result.personal).toBeDefined();
  });

  it('handles nested objects in family (siblings, additionalDegrees)', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      family: {
        familyType: 'JOINT',
        siblings: [
          { name: 'Rahul', married: true, occupation: 'Doctor' },
          { name: 'Neha', married: false },
        ],
      },
      education: {
        degree: 'B.Tech',
        college: 'IIT Bombay',
        additionalDegrees: [
          { degree: 'MBA', college: 'ISB', year: 2022 },
        ],
      },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('returns merged content with completenessScore', async () => {
    const updatedContent = { ...mockProfileContent, updatedAt: new Date() };
    setupProfileContentFindOneAndUpdate(updatedContent);
    setupProfileContentFindOne(updatedContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      lifestyle: { diet: 'VEG' },
    });
    expect(result).toHaveProperty('completenessScore');
    expect(typeof result.completenessScore).toBe('number');
  });

  it('fetches content from database if no updates return content', async () => {
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      family: { familyType: 'NUCLEAR' },
    });
    expect(result.userId).toBe(mockUserId);
    expect(result.completenessScore).toBeDefined();
  });

  it('handles optional fields correctly (skips null/undefined values)', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      profession: {
        occupation: 'Engineer',
        // incomeRange is undefined, should be skipped
        workingAbroad: undefined,
      },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('applies all family fields when provided', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      family: {
        fatherName: 'Rajesh Kumar',
        motherName: 'Sunita Kumar',
        familyType: 'JOINT',
        familyValues: 'TRADITIONAL',
        familyStatus: 'UPPER_MIDDLE',
        nativePlace: 'Jaipur',
        familyAbout: 'Close-knit family',
      },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('applies all lifestyle fields when provided', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      lifestyle: {
        diet: 'VEG',
        smoking: 'NEVER',
        drinking: 'OCCASIONALLY',
        hobbies: ['Reading', 'Cooking'],
        interests: ['Travel', 'Photography'],
        hyperNicheTags: ['career-first', 'spiritual'],
        languagesSpoken: ['English', 'Hindi', 'Gujarati'],
        ownHouse: true,
        ownCar: false,
        fitnessLevel: 'ACTIVE',
      },
    });
    expect(result.completenessScore).toBeDefined();
  });

  it('applies all profession fields when provided', async () => {
    setupProfileContentFindOneAndUpdate(mockProfileContent);
    setupProfileContentFindOne(mockProfileContent);
    setupSelectReturns([{ id: mockProfileId }], [{ value: 0 }]);
    setupInsertOk();
    setupUpdateOk();
    const result = await bulkUpdateContent(mockUserId, {
      profession: {
        occupation: 'Software Engineer',
        employer: 'Google',
        incomeRange: '20-30 LPA',
        workLocation: 'Bangalore',
        workingAbroad: false,
        employerType: 'PRIVATE',
        designation: 'Senior Engineer',
        abroadCountry: undefined,
      },
    });
    expect(result.completenessScore).toBeDefined();
  });
});
