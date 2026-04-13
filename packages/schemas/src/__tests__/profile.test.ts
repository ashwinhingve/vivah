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
