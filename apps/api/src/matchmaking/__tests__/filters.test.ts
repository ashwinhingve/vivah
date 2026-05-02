import { describe, it, expect } from 'vitest';
import { applyHardFilters, type ProfileWithPreferences } from '../filters.js';

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

// ── Distance filter tests ──────────────────────────────────────────────────

const distanceBase: ProfileWithPreferences = {
  id: 'a',
  age: 28,
  religion: 'Hindu',
  city: 'Pune',
  state: 'Maharashtra',
  incomeMin: 50000,
  incomeMax: 100000,
  latitude: 18.5204,
  longitude: 73.8567,
  preferences: {
    ageMin: 22,
    ageMax: 35,
    religion: ['Hindu'],
    openToInterfaith: false,
    city: 'Pune',
    state: 'Maharashtra',
    incomeMin: 30000,
    incomeMax: 200000,
    maxDistanceKm: 100,
  },
};

describe('distance filter', () => {
  it('passes when both within radius', () => {
    const cand: ProfileWithPreferences = { ...distanceBase, id: 'b', latitude: 18.6, longitude: 73.9 };
    expect(applyHardFilters(distanceBase, [cand])).toHaveLength(1);
  });

  it('fails when beyond limit', () => {
    const cand: ProfileWithPreferences = { ...distanceBase, id: 'b', latitude: 28.7, longitude: 77.1 };
    expect(applyHardFilters(distanceBase, [cand])).toHaveLength(0);
  });

  it('falls back to state match when coords missing', () => {
    const u: ProfileWithPreferences = { ...distanceBase, latitude: null, longitude: null };
    const cand: ProfileWithPreferences = { ...distanceBase, id: 'b', latitude: null, longitude: null };
    expect(applyHardFilters(u, [cand])).toHaveLength(1);
  });

  it('mustHave.distance disables fallback', () => {
    const u: ProfileWithPreferences = {
      ...distanceBase,
      latitude: null,
      longitude: null,
      preferences: { ...distanceBase.preferences, mustHave: { distance: true } },
    };
    const cand: ProfileWithPreferences = { ...distanceBase, id: 'b', latitude: null, longitude: null };
    expect(applyHardFilters(u, [cand])).toHaveLength(0);
  });
});

describe('mustHave education', () => {
  it('promotes soft to hard when set', () => {
    const u: ProfileWithPreferences = {
      ...distanceBase,
      education: 'masters',
      preferences: {
        ...distanceBase.preferences,
        education: ['masters'],
        mustHave: { education: true },
      },
    };
    const candPass: ProfileWithPreferences = { ...distanceBase, id: 'b', education: 'masters' };
    const candFail: ProfileWithPreferences = { ...distanceBase, id: 'c', education: '12th' };
    expect(applyHardFilters(u, [candPass, candFail])).toHaveLength(1);
  });
});

describe('mustHave religion bypasses interfaith', () => {
  it('rejects interfaith even when openToInterfaith=true', () => {
    const u: ProfileWithPreferences = {
      ...distanceBase,
      preferences: {
        ...distanceBase.preferences,
        openToInterfaith: true,
        mustHave: { religion: true },
      },
    };
    const cand: ProfileWithPreferences = { ...distanceBase, id: 'b', religion: 'Christian' };
    expect(applyHardFilters(u, [cand])).toHaveLength(0);
  });
});

describe('mustHave diet', () => {
  it('promotes diet preference to hard filter', () => {
    const u: ProfileWithPreferences = {
      ...distanceBase,
      diet: 'VEG',
      preferences: {
        ...distanceBase.preferences,
        diet: ['VEG'],
        mustHave: { diet: true },
      },
    };
    const candPass: ProfileWithPreferences = { ...distanceBase, id: 'b', diet: 'VEG' };
    const candFail: ProfileWithPreferences = { ...distanceBase, id: 'c', diet: 'NON_VEG' };
    expect(applyHardFilters(u, [candPass, candFail])).toHaveLength(1);
  });
});
