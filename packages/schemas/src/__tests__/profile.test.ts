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
  ProfileBulkUpdateSchema,
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

describe('UpdateFamilySchema (enhanced)', () => {
  it('accepts valid family data', () => {
    const result = UpdateFamilySchema.safeParse({
      fatherName: 'Ramesh Kumar',
      familyType: 'JOINT',
      familyValues: 'TRADITIONAL',
      familyStatus: 'MIDDLE_CLASS',
      nativePlace: 'Pune',
      familyAbout: 'Close-knit family from Maharashtra.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid familyType', () => {
    const result = UpdateFamilySchema.safeParse({ familyType: 'CHAOS' });
    expect(result.success).toBe(false);
  });

  it('rejects siblings array exceeding 10 entries', () => {
    const siblings = Array.from({ length: 11 }, (_, i) => ({ name: `Sibling ${i}` }));
    const result = UpdateFamilySchema.safeParse({ siblings });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 10 siblings', () => {
    const siblings = Array.from({ length: 10 }, (_, i) => ({ name: `Sibling ${i}` }));
    const result = UpdateFamilySchema.safeParse({ siblings });
    expect(result.success).toBe(true);
  });

  it('rejects invalid familyValues', () => {
    const result = UpdateFamilySchema.safeParse({ familyValues: 'ANARCHIST' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid familyStatus', () => {
    const result = UpdateFamilySchema.safeParse({ familyStatus: 'RICH' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid familyType values', () => {
    expect(UpdateFamilySchema.safeParse({ familyType: 'JOINT' }).success).toBe(true);
    expect(UpdateFamilySchema.safeParse({ familyType: 'NUCLEAR' }).success).toBe(true);
    expect(UpdateFamilySchema.safeParse({ familyType: 'EXTENDED' }).success).toBe(true);
  });
});

describe('UpdateLifestyleSchema (enhanced)', () => {
  it('accepts valid lifestyle data', () => {
    const result = UpdateLifestyleSchema.safeParse({
      diet: 'VEG',
      smoking: 'NEVER',
      drinking: 'NEVER',
      hobbies: ['Reading', 'Cooking'],
      fitnessLevel: 'ACTIVE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid diet value', () => {
    const result = UpdateLifestyleSchema.safeParse({ diet: 'PALEO' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid diet values', () => {
    expect(UpdateLifestyleSchema.safeParse({ diet: 'VEG' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ diet: 'NON_VEG' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ diet: 'JAIN' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ diet: 'VEGAN' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ diet: 'EGGETARIAN' }).success).toBe(true);
  });

  it('rejects unknown hyperNicheTags', () => {
    const result = UpdateLifestyleSchema.safeParse({
      hyperNicheTags: ['unknown-tag-xyz'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid hyperNicheTags', () => {
    const result = UpdateLifestyleSchema.safeParse({
      hyperNicheTags: ['career-first', 'entrepreneur', 'spiritual'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts null fitnessLevel', () => {
    const result = UpdateLifestyleSchema.safeParse({ fitnessLevel: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid fitnessLevel', () => {
    const result = UpdateLifestyleSchema.safeParse({ fitnessLevel: 'SUPER_ACTIVE' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid fitnessLevel values', () => {
    expect(UpdateLifestyleSchema.safeParse({ fitnessLevel: 'ACTIVE' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ fitnessLevel: 'MODERATE' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ fitnessLevel: 'SEDENTARY' }).success).toBe(true);
  });

  it('accepts valid smoking and drinking values', () => {
    expect(UpdateLifestyleSchema.safeParse({ smoking: 'NEVER' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ smoking: 'OCCASIONALLY' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ smoking: 'REGULARLY' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ drinking: 'NEVER' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ drinking: 'OCCASIONALLY' }).success).toBe(true);
    expect(UpdateLifestyleSchema.safeParse({ drinking: 'REGULARLY' }).success).toBe(true);
  });

  it('rejects invalid smoking value', () => {
    const result = UpdateLifestyleSchema.safeParse({ smoking: 'SOMETIMES' });
    expect(result.success).toBe(false);
  });

  it('accepts hobbies and interests arrays', () => {
    const result = UpdateLifestyleSchema.safeParse({
      hobbies: ['Reading', 'Cooking', 'Painting'],
      interests: ['Travel', 'Photography'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts languagesSpoken up to 10', () => {
    const langs = Array.from({ length: 10 }, (_, i) => `Language${i}`);
    const result = UpdateLifestyleSchema.safeParse({ languagesSpoken: langs });
    expect(result.success).toBe(true);
  });

  it('rejects languagesSpoken exceeding 10', () => {
    const langs = Array.from({ length: 11 }, (_, i) => `Language${i}`);
    const result = UpdateLifestyleSchema.safeParse({ languagesSpoken: langs });
    expect(result.success).toBe(false);
  });

  it('accepts boolean properties for ownHouse and ownCar', () => {
    const result = UpdateLifestyleSchema.safeParse({
      ownHouse: true,
      ownCar: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('ProfileBulkUpdateSchema', () => {
  it('rejects empty object', () => {
    const result = ProfileBulkUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts partial update with only lifestyle', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      lifestyle: { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only family', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      family: { familyType: 'NUCLEAR' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only education', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      education: { degree: 'B.Tech', college: 'IIT Bombay' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only profession', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      profession: { occupation: 'Engineer', incomeRange: '10-15 LPA' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts update with multiple sections', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      family: { familyType: 'NUCLEAR' },
      lifestyle: { diet: 'JAIN' },
      education: { degree: 'MBA', college: 'XLRI' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts update with all four sections', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      family: { familyType: 'JOINT', familyValues: 'TRADITIONAL' },
      lifestyle: { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER' },
      education: { degree: 'B.Tech', college: 'IIT Bombay', year: 2020 },
      profession: { occupation: 'Engineer', incomeRange: '15-20 LPA' },
    });
    expect(result.success).toBe(true);
  });

  it('maintains schema validation within each section', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      family: { familyType: 'INVALID_TYPE' },
      lifestyle: { diet: 'VEG' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects update with only undefined/null values', () => {
    const result = ProfileBulkUpdateSchema.safeParse({
      family: undefined,
      lifestyle: undefined,
    });
    expect(result.success).toBe(false);
  });
});
