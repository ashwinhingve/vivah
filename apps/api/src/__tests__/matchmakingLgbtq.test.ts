/**
 * Matchmaking gender filter — LGBTQ+ toggle behavior.
 *
 * Exercises applyHardFilters with explicit lgbtqEnabled values to verify:
 *   - flag off: only MALE<->FEMALE pairs survive; same-gender drops
 *   - flag on : same-gender pair survives when partnerGender lists are aligned
 *   - flag on : same-gender pair drops when partnerGender lists do not align
 *
 * Profile objects are pure ProfileWithPreferences fixtures — no db, no Mongo.
 */
import { describe, it, expect } from 'vitest';
import { applyHardFilters, type ProfileWithPreferences, type GenderValue } from '../matchmaking/filters.js';

function profile(opts: {
  id:           string;
  gender:       GenderValue;
  partnerGender?: GenderValue[];
  age?:         number;
  religion?:    string;
}): ProfileWithPreferences {
  return {
    id:        opts.id,
    age:       opts.age ?? 28,
    gender:    opts.gender,
    religion:  opts.religion ?? 'Hindu',
    city:      'Mumbai',
    state:     'Maharashtra',
    incomeMin: 500000,
    incomeMax: 5000000,
    preferences: {
      ageMin:           18,
      ageMax:           60,
      religion:         ['Hindu'],
      openToInterfaith: true,
      city:             'Mumbai',
      state:            'Maharashtra',
      incomeMin:        100000,
      incomeMax:        10000000,
      ...(opts.partnerGender ? { partnerGender: opts.partnerGender } : {}),
    },
  };
}

describe('Matchmaking gender filter — lgbtq toggle', () => {
  it('flag OFF — drops same-gender pair (M/M)', () => {
    const user = profile({ id: 'a', gender: 'MALE' });
    const cand = profile({ id: 'b', gender: 'MALE' });
    const survived = applyHardFilters(user, [cand], { lgbtqEnabled: false });
    expect(survived.map((p) => p.id)).toEqual([]);
  });

  it('flag OFF — keeps opposite-gender pair (M/F)', () => {
    const user = profile({ id: 'a', gender: 'MALE' });
    const cand = profile({ id: 'b', gender: 'FEMALE' });
    const survived = applyHardFilters(user, [cand], { lgbtqEnabled: false });
    expect(survived.map((p) => p.id)).toEqual(['b']);
  });

  it('flag ON — keeps same-gender pair when partnerGender lists align', () => {
    const user = profile({ id: 'a', gender: 'MALE',   partnerGender: ['MALE'] });
    const cand = profile({ id: 'b', gender: 'MALE',   partnerGender: ['MALE'] });
    const survived = applyHardFilters(user, [cand], { lgbtqEnabled: true });
    expect(survived.map((p) => p.id)).toEqual(['b']);
  });

  it('flag ON — drops same-gender pair when partnerGender disagrees', () => {
    const user = profile({ id: 'a', gender: 'MALE',   partnerGender: ['MALE'] });
    // candidate identifies as MALE but is only interested in FEMALE
    const cand = profile({ id: 'b', gender: 'MALE',   partnerGender: ['FEMALE'] });
    const survived = applyHardFilters(user, [cand], { lgbtqEnabled: true });
    expect(survived.map((p) => p.id)).toEqual([]);
  });

  it('flag ON — NON_BINARY participates when preferences align', () => {
    const user = profile({ id: 'a', gender: 'NON_BINARY', partnerGender: ['NON_BINARY', 'FEMALE'] });
    const cand = profile({ id: 'b', gender: 'NON_BINARY', partnerGender: ['NON_BINARY'] });
    const survived = applyHardFilters(user, [cand], { lgbtqEnabled: true });
    expect(survived.map((p) => p.id)).toEqual(['b']);
  });

  it('flag OFF — NON_BINARY user has no eligible candidates (privacy default)', () => {
    const user = profile({ id: 'a', gender: 'NON_BINARY' });
    const cands = [
      profile({ id: 'b', gender: 'MALE' }),
      profile({ id: 'c', gender: 'FEMALE' }),
    ];
    const survived = applyHardFilters(user, cands, { lgbtqEnabled: false });
    expect(survived.map((p) => p.id)).toEqual([]);
  });
});
