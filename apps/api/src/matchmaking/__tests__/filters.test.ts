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

// ── Income filter (bilateral preference vs own) ──────────────────────────────
//
// Regression for the production bug where two verified test users with
// permissive preferences ("0-100 LPA") still failed the income filter because
// the old check compared own range vs own range. The corrected filter compares
// each side's *partner preference* against the other side's own income.

describe('income filter (bilateral preference)', () => {
  // Helper that mirrors UserA (5-10 LPA earner) vs UserB (< 3 LPA earner) with
  // both setting permissive 0-100 LPA partner preferences.
  const userA_5to10: ProfileWithPreferences = {
    id: 'A',
    age: 30,
    religion: 'Hindu',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    incomeMin: 41667,   // 5 LPA / 12
    incomeMax: 83333,   // 10 LPA / 12
    preferences: {
      ageMin: 18,
      ageMax: 75,
      religion: ['Hindu'],
      openToInterfaith: true,
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      incomeMin: 0,
      incomeMax: 833333,  // 100 LPA / 12
      openToInterCaste: true,
      maxDistanceKm: 10000,
    },
  };
  const userB_lt3: ProfileWithPreferences = {
    ...userA_5to10,
    id: 'B',
    incomeMin: 25000,   // < 3 LPA → ~25000
    incomeMax: 25000,
  };

  it('passes when both sides have permissive prefs (production scenario)', () => {
    expect(applyHardFilters(userA_5to10, [userB_lt3])).toHaveLength(1);
    expect(applyHardFilters(userB_lt3, [userA_5to10])).toHaveLength(1);
  });

  it("rejects when user's pref does not include candidate's income", () => {
    const strict: ProfileWithPreferences = {
      ...userA_5to10,
      preferences: { ...userA_5to10.preferences, incomeMin: 50000, incomeMax: 100000 },
    };
    // userB earns 25000 — outside strict.prefs [50000, 100000]
    expect(applyHardFilters(strict, [userB_lt3])).toHaveLength(0);
  });

  it("rejects when candidate's pref does not include user's income (bilateral)", () => {
    const strictCand: ProfileWithPreferences = {
      ...userB_lt3,
      preferences: { ...userB_lt3.preferences, incomeMin: 100000, incomeMax: 200000 },
    };
    // userA earns 41667-83333 — outside strictCand.prefs [100000, 200000]
    expect(applyHardFilters(userA_5to10, [strictCand])).toHaveLength(0);
  });

  it('passes when ranges are equal', () => {
    const same: ProfileWithPreferences = { ...userA_5to10, id: 'C' };
    expect(applyHardFilters(userA_5to10, [same])).toHaveLength(1);
  });
});

// ── NRI / cross-border matching (Phase 7 Sprint G, Unit 7.2) ──────────────
//
// The flag is INJECTED via applyHardFilters' options ({ nriMatchingLive }),
// defaulting to the NRI_MATCHING_LIVE env flag. It is deliberately not read from
// the module-level `isNriMatchingLive` const inside the filter: that const binds
// at import time, so a filter reading it directly cannot be exercised in both
// states, and every test would have to assert a failure path.
//
// That matters more than it sounds. This suite was briefly green while the entire
// bypass was missing from the file — because with only negative cases, "feature
// absent" and "feature correctly inert" are indistinguishable. The flag-ON cases
// below are the ones that actually fail if the implementation disappears.
//
// Regression guarantee (flag OFF, the default): cross-border pairs are rejected
// by haversine, and the city/state fallback can't rescue them, so the feed is
// byte-identical to pre-Sprint-G.

describe('NRI cross-border matching (Phase 7 Sprint G)', () => {
  it('treats IN and in as same country (case-insensitive) — not cross-border', () => {
    const userIN_uppercase: ProfileWithPreferences = {
      id: 'user-case-1',
      age: 32,
      religion: 'Hindu',
      city: 'Mumbai',
      state: 'Maharashtra',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 19.0760,
      longitude: 72.8777,
      preferences: {
        ageMin: 25,
        ageMax: 38,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 200000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const candidatein_lowercase: ProfileWithPreferences = {
      id: 'cand-case-1',
      age: 30,
      religion: 'Hindu',
      city: 'Bangalore',
      state: 'Karnataka',
      incomeMin: 60000,
      incomeMax: 120000,
      countryOfResidence: 'in',
      openToNriMatching: true,
      latitude: 12.9716,
      longitude: 77.5946,
      preferences: {
        ageMin: 26,
        ageMax: 40,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Bangalore',
        state: 'Karnataka',
        incomeMin: 40000,
        incomeMax: 250000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    // Both IN and in lowercase should NOT trigger cross-border bypass
    // Instead, normal distance check applies: Mumbai↔Bangalore ~800km > 100km → fails
    const result = applyHardFilters(userIN_uppercase, [candidatein_lowercase]);
    expect(result).toHaveLength(0);
  });

  it('fails when only one side opted in to NRI matching', () => {
    const user: ProfileWithPreferences = {
      id: 'user-nri-2',
      age: 32,
      religion: 'Hindu',
      city: 'Mumbai',
      state: 'Maharashtra',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 19.0760,
      longitude: 72.8777,
      preferences: {
        ageMin: 25,
        ageMax: 38,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 200000,
        openToNriMatching: true,
      },
    };

    const candidateNotOptedIn: ProfileWithPreferences = {
      id: 'cand-nri-2',
      age: 30,
      religion: 'Hindu',
      city: 'London',
      state: 'England',
      incomeMin: 60000,
      incomeMax: 120000,
      countryOfResidence: 'GB',
      openToNriMatching: false,
      latitude: 51.5074,
      longitude: -0.1278,
      preferences: {
        ageMin: 26,
        ageMax: 40,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'London',
        state: 'England',
        incomeMin: 40000,
        incomeMax: 250000,
        openToNriMatching: false,
      },
    };

    const result = applyHardFilters(user, [candidateNotOptedIn]);
    expect(result).toHaveLength(0);
  });

  it('fails when cross-border + both opted in but one side has mustHave.distance', () => {
    const userWithMustHave: ProfileWithPreferences = {
      id: 'user-nri-3',
      age: 32,
      religion: 'Hindu',
      city: 'Mumbai',
      state: 'Maharashtra',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 19.0760,
      longitude: 72.8777,
      preferences: {
        ageMin: 25,
        ageMax: 38,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 200000,
        openToNriMatching: true,
        mustHave: { distance: true },
      },
    };

    const candidate: ProfileWithPreferences = {
      id: 'cand-nri-3',
      age: 30,
      religion: 'Hindu',
      city: 'London',
      state: 'England',
      incomeMin: 60000,
      incomeMax: 120000,
      countryOfResidence: 'GB',
      openToNriMatching: true,
      latitude: 51.5074,
      longitude: -0.1278,
      preferences: {
        ageMin: 26,
        ageMax: 40,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'London',
        state: 'England',
        incomeMin: 40000,
        incomeMax: 250000,
        openToNriMatching: true,
      },
    };

    const result = applyHardFilters(userWithMustHave, [candidate]);
    expect(result).toHaveLength(0);
  });

  it('fails when same country + 500km apart even if both opted in (domestic unaffected)', () => {
    const user: ProfileWithPreferences = {
      id: 'user-nri-4',
      age: 32,
      religion: 'Hindu',
      city: 'Mumbai',
      state: 'Maharashtra',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 19.0760,
      longitude: 72.8777,
      preferences: {
        ageMin: 25,
        ageMax: 38,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 200000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const candidateFarDomestic: ProfileWithPreferences = {
      id: 'cand-nri-4',
      age: 30,
      religion: 'Hindu',
      city: 'Delhi',
      state: 'Delhi',
      incomeMin: 60000,
      incomeMax: 120000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 28.7041,
      longitude: 77.1025,
      preferences: {
        ageMin: 26,
        ageMax: 40,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Delhi',
        state: 'Delhi',
        incomeMin: 40000,
        incomeMax: 250000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const result = applyHardFilters(user, [candidateFarDomestic]);
    expect(result).toHaveLength(0);
  });

  it('passes when domestic pair within 100km (not affected by NRI logic)', () => {
    const user: ProfileWithPreferences = {
      id: 'user-nri-5',
      age: 32,
      religion: 'Hindu',
      city: 'Mumbai',
      state: 'Maharashtra',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 19.0760,
      longitude: 72.8777,
      preferences: {
        ageMin: 25,
        ageMax: 38,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 200000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const candidateNearby: ProfileWithPreferences = {
      id: 'cand-nri-5',
      age: 30,
      religion: 'Hindu',
      city: 'Thane',
      state: 'Maharashtra',
      incomeMin: 60000,
      incomeMax: 120000,
      countryOfResidence: 'IN',
      openToNriMatching: true,
      latitude: 19.2183,
      longitude: 72.9781,
      preferences: {
        ageMin: 26,
        ageMax: 40,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Thane',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 250000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const result = applyHardFilters(user, [candidateNearby]);
    expect(result).toHaveLength(1);
  });

  it('passes when both countryOfResidence null + within 100km (backward compat)', () => {
    const user: ProfileWithPreferences = {
      id: 'user-nri-6',
      age: 32,
      religion: 'Hindu',
      city: 'Mumbai',
      state: 'Maharashtra',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: null,
      openToNriMatching: true,
      latitude: 19.0760,
      longitude: 72.8777,
      preferences: {
        ageMin: 25,
        ageMax: 38,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 200000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const candidate: ProfileWithPreferences = {
      id: 'cand-nri-6',
      age: 30,
      religion: 'Hindu',
      city: 'Thane',
      state: 'Maharashtra',
      incomeMin: 60000,
      incomeMax: 120000,
      countryOfResidence: null,
      openToNriMatching: true,
      latitude: 19.2183,
      longitude: 72.9781,
      preferences: {
        ageMin: 26,
        ageMax: 40,
        religion: ['Hindu'],
        openToInterfaith: false,
        city: 'Thane',
        state: 'Maharashtra',
        incomeMin: 40000,
        incomeMax: 250000,
        openToNriMatching: true,
        maxDistanceKm: 100,
      },
    };

    const result = applyHardFilters(user, [candidate]);
    expect(result).toHaveLength(1);
  });
});

// ── The flag-ON path: the cases that fail if the bypass is missing ───────────
//
// Everything above asserts a rejection, so all of it stays green even with the
// feature deleted. These do not.

describe('NRI cross-border matching — flag ON (Phase 7 Sprint G)', () => {
  /** Compatible on every non-distance axis, so distance is the only variable. */
  function intlProfile(
    id: string,
    country: string,
    coords: { lat: number; lng: number },
    overrides: Partial<ProfileWithPreferences> = {},
  ): ProfileWithPreferences {
    return {
      id,
      age: 30,
      religion: 'Hindu',
      city: 'City',
      state: 'State',
      incomeMin: 50000,
      incomeMax: 150000,
      countryOfResidence: country,
      openToNriMatching: true,
      latitude: coords.lat,
      longitude: coords.lng,
      preferences: {
        ageMin: 20,
        ageMax: 45,
        religion: ['Hindu'],
        openToInterfaith: true,
        city: 'City',
        state: 'State',
        incomeMin: 0,
        incomeMax: 999999,
        maxDistanceKm: 100,
      },
      ...overrides,
    };
  }

  // Pune <-> Toronto, ~12,000km apart: ~120x the 100km default limit.
  const pune    = () => intlProfile('u-pune', 'IN', { lat: 18.5204, lng: 73.8567 });
  const toronto = () => intlProfile('c-toronto', 'CA', { lat: 43.6532, lng: -79.3832 });

  it('surfaces a cross-border pair when both opted in and the flag is ON', () => {
    const result = applyHardFilters(pune(), [toronto()], { nriMatchingLive: true });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('c-toronto');
  });

  it('rejects that same pair when the flag is OFF — the regression guard', () => {
    const result = applyHardFilters(pune(), [toronto()], { nriMatchingLive: false });
    expect(result).toHaveLength(0);
  });

  it('rejects when only one side opted in, even with the flag ON', () => {
    const notOptedIn = intlProfile('c-toronto', 'CA', { lat: 43.6532, lng: -79.3832 }, {
      openToNriMatching: false,
    });
    const result = applyHardFilters(pune(), [notOptedIn], { nriMatchingLive: true });
    expect(result).toHaveLength(0);
  });

  it('lets an explicit mustHave.distance beat the opt-in, flag ON', () => {
    const strict = pune();
    strict.preferences.mustHave = { distance: true };
    const result = applyHardFilters(strict, [toronto()], { nriMatchingLive: true });
    expect(result).toHaveLength(0);
  });

  it('still distance-limits a DOMESTIC pair that both opted in, flag ON', () => {
    // Mumbai <-> Bangalore, ~840km, both 'IN'. The bypass requires the countries
    // to DIFFER, so this must still fail — this is what keeps the feed safe.
    const mumbai    = intlProfile('u-mum', 'IN', { lat: 19.0760, lng: 72.8777 });
    const bangalore = intlProfile('c-blr', 'IN', { lat: 12.9716, lng: 77.5946 });
    const result = applyHardFilters(mumbai, [bangalore], { nriMatchingLive: true });
    expect(result).toHaveLength(0);
  });

  it('treats in/IN as the same country, so a domestic pair cannot take the bypass', () => {
    const mumbai    = intlProfile('u-mum', 'IN', { lat: 19.0760, lng: 72.8777 });
    const bangalore = intlProfile('c-blr', 'in', { lat: 12.9716, lng: 77.5946 });
    const result = applyHardFilters(mumbai, [bangalore], { nriMatchingLive: true });
    expect(result).toHaveLength(0);
  });

  it('does not bypass when a country is unknown, flag ON', () => {
    const unknown = intlProfile('c-unknown', '', { lat: 43.6532, lng: -79.3832 });
    const result = applyHardFilters(pune(), [unknown], { nriMatchingLive: true });
    expect(result).toHaveLength(0);
  });

  it('honours the Mongo preference fallback when the column is unset', () => {
    // A row written before the column existed: delete it outright rather than
    // setting it to undefined — `exactOptionalPropertyTypes` treats an explicit
    // `undefined` as a distinct (and rejected) value from an absent key.
    const legacy = intlProfile('c-toronto', 'CA', { lat: 43.6532, lng: -79.3832 });
    delete legacy.openToNriMatching;
    legacy.preferences.openToNriMatching = true;
    const result = applyHardFilters(pune(), [legacy], { nriMatchingLive: true });
    expect(result).toHaveLength(1);
  });

  it('does not widen a nearby domestic pair — they still pass as before', () => {
    const mumbai = intlProfile('u-mum', 'IN', { lat: 19.0760, lng: 72.8777 });
    const thane  = intlProfile('c-thane', 'IN', { lat: 19.2183, lng: 72.9781 });
    const result = applyHardFilters(mumbai, [thane], { nriMatchingLive: true });
    expect(result).toHaveLength(1);
  });
});
