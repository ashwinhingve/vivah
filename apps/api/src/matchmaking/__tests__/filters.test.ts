import { describe, it, expect } from 'vitest';
import { applyHardFilters } from '../filters.js';

interface ProfileWithPreferences {
  id: string
  age: number
  religion: string
  city: string
  state: string
  incomeMin: number
  incomeMax: number
  preferences: {
    ageMin: number
    ageMax: number
    religion: string[]
    openToInterfaith: boolean
    city: string
    state: string
    incomeMin: number
    incomeMax: number
  }
}

// Base user profile — age 35, Hindu
const baseUser: ProfileWithPreferences = {
  id: 'user-1',
  age: 35,
  religion: 'Hindu',
  city: 'Mumbai',
  state: 'Maharashtra',
  incomeMin: 50000,
  incomeMax: 150000,
  preferences: {
    ageMin: 28,
    ageMax: 38,
    religion: ['Hindu'],
    openToInterfaith: false,
    city: 'Mumbai',
    state: 'Maharashtra',
    incomeMin: 40000,
    incomeMax: 200000,
  },
};

// Base candidate — age 30, Hindu, same location
const baseCandidate: ProfileWithPreferences = {
  id: 'cand-1',
  age: 30,
  religion: 'Hindu',
  city: 'Mumbai',
  state: 'Maharashtra',
  incomeMin: 60000,
  incomeMax: 120000,
  preferences: {
    ageMin: 28,
    ageMax: 40,
    religion: ['Hindu'],
    openToInterfaith: false,
    city: 'Mumbai',
    state: 'Maharashtra',
    incomeMin: 40000,
    incomeMax: 200000,
  },
};

describe('applyHardFilters', () => {
  // Test 1: bilateral age — fails
  it('removes candidate when user age (35) is outside candidate ageMax (30)', () => {
    const candidate: ProfileWithPreferences = {
      ...baseCandidate,
      preferences: {
        ...baseCandidate.preferences,
        ageMax: 30, // user is 35, so user is outside candidate's range
      },
    };
    const result = applyHardFilters(baseUser, [candidate]);
    expect(result).toHaveLength(0);
  });

  // Test 2: bilateral age — passes
  it('keeps candidate when both sides are within each other age range', () => {
    // user age=35, cand.prefs.ageMin=28, cand.prefs.ageMax=40 → 35 is in [28,40] ✓
    // cand age=30, user.prefs.ageMin=28, user.prefs.ageMax=38 → 30 is in [28,38] ✓
    const result = applyHardFilters(baseUser, [baseCandidate]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('cand-1');
  });

  // Test 3: religion block
  it('removes candidate when religions differ and both openToInterfaith=false', () => {
    const candidate: ProfileWithPreferences = {
      ...baseCandidate,
      religion: 'Muslim',
      preferences: {
        ...baseCandidate.preferences,
        openToInterfaith: false,
      },
    };
    const result = applyHardFilters(baseUser, [candidate]);
    expect(result).toHaveLength(0);
  });

  // Test 4: interfaith — candidate side only
  it('keeps candidate when candidate has openToInterfaith=true even if religions differ', () => {
    const candidate: ProfileWithPreferences = {
      ...baseCandidate,
      religion: 'Muslim',
      preferences: {
        ...baseCandidate.preferences,
        openToInterfaith: true,
      },
    };
    const result = applyHardFilters(baseUser, [candidate]);
    expect(result).toHaveLength(1);
  });

  // Test 5: both interfaith
  it('keeps candidate when both openToInterfaith=true', () => {
    const user: ProfileWithPreferences = {
      ...baseUser,
      religion: 'Sikh',
      preferences: {
        ...baseUser.preferences,
        openToInterfaith: true,
      },
    };
    const candidate: ProfileWithPreferences = {
      ...baseCandidate,
      religion: 'Hindu',
      preferences: {
        ...baseCandidate.preferences,
        openToInterfaith: true,
      },
    };
    const result = applyHardFilters(user, [candidate]);
    expect(result).toHaveLength(1);
  });

  // Test 6: empty input
  it('returns empty array when candidates list is empty', () => {
    const result = applyHardFilters(baseUser, []);
    expect(result).toHaveLength(0);
  });

  // Test 7: all pass
  it('retains candidate when all filters pass', () => {
    const result = applyHardFilters(baseUser, [baseCandidate]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('cand-1');
  });
});
