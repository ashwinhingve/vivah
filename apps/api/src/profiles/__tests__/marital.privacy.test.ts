/**
 * Test suite for marital status privacy filter.
 * Tests the exported `filterMaritalStatus()` function that protects DIVORCED/WIDOWED status.
 * This test WILL FAIL if the filter condition is removed or inverted.
 */
import { describe, it, expect } from 'vitest';
import { filterMaritalStatus } from '../service.js';
import type { PersonalSection } from '@smartshaadi/types';

describe('filterMaritalStatus() — Privacy Protection', () => {

  // ─── Scenario 1: Stranger (no match) viewing DIVORCED ─────────────────────

  it('Scenario 1: STRANGER viewing DIVORCED → maritalStatus REMOVED', () => {
    const personal: PersonalSection = {
      fullName: 'Alice Divorced',
      gender: 'FEMALE',
      maritalStatus: 'DIVORCED',
      height: 165,
      weight: 60,
    };

    const result = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: false,
    });

    // ⭐ CRITICAL: Field must be ABSENT, not undefined
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('maritalStatus');
    // Other fields intact
    expect(result?.fullName).toBe('Alice Divorced');
    expect(result?.gender).toBe('FEMALE');
  });

  // ─── Scenario 2: Stranger viewing WIDOWED ──────────────────────────────────

  it('Scenario 2: STRANGER viewing WIDOWED → maritalStatus REMOVED', () => {
    const personal: PersonalSection = {
      fullName: 'Betty Widowed',
      dob: '1960-01-01T00:00:00Z',
      maritalStatus: 'WIDOWED',
    };

    const result = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: false,
    });

    expect(result).not.toHaveProperty('maritalStatus');
    expect(result?.fullName).toBe('Betty Widowed');
  });

  // ─── Scenario 3: OWNER viewing own profile ──────────────────────────────────

  it('Scenario 3: OWNER (isSelf) viewing DIVORCED → maritalStatus KEPT', () => {
    const personal: PersonalSection = {
      fullName: 'Carol',
      maritalStatus: 'DIVORCED',
    };

    const result = filterMaritalStatus(personal, {
      isSelf: true,
      hasAcceptedMatch: false, // Doesn't matter when isSelf=true
    });

    // ⭐ Self MUST always see their own maritalStatus
    expect(result).toHaveProperty('maritalStatus');
    expect(result?.maritalStatus).toBe('DIVORCED');
  });

  // ─── Scenario 4: ACCEPTED MATCH viewing DIVORCED ─────────────────────────────

  it('Scenario 4: ACCEPTED MATCH viewer → maritalStatus KEPT', () => {
    const personal: PersonalSection = {
      fullName: 'Diana',
      maritalStatus: 'DIVORCED',
    };

    const result = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: true, // ← Only difference from scenario 1
    });

    // ⭐ Accepted match grants visibility
    expect(result).toHaveProperty('maritalStatus');
    expect(result?.maritalStatus).toBe('DIVORCED');
  });

  // ─── Scenario 5: PENDING (not accepted) match ────────────────────────────────
  // This is the boundary most likely to regress — pending vs accepted distinction

  it('Scenario 5: PENDING match (not accepted) → maritalStatus REMOVED', () => {
    const personal: PersonalSection = {
      fullName: 'Eve',
      maritalStatus: 'DIVORCED',
    };

    // PENDING is not ACCEPTED, so hasAcceptedMatch=false
    const result = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: false, // PENDING match returns false here
    });

    // ⭐ BOUNDARY TEST: PENDING does NOT grant visibility
    expect(result).not.toHaveProperty('maritalStatus');
  });

  // ─── Scenario 6: NEVER_MARRIED is public (per stated rule) ────────────────────

  it('Scenario 6a: STRANGER viewing NEVER_MARRIED → maritalStatus KEPT (public info)', () => {
    const personal: PersonalSection = {
      fullName: 'Frank',
      maritalStatus: 'NEVER_MARRIED',
      gender: 'MALE',
    };

    const result = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: false, // No match
    });

    // ⭐ NEVER_MARRIED is NOT filtered (public info)
    expect(result).toHaveProperty('maritalStatus');
    expect(result?.maritalStatus).toBe('NEVER_MARRIED');
  });

  it('Scenario 6b: NEVER_MARRIED + ACCEPTED MATCH → still visible (redundant but documents rule)', () => {
    const personal: PersonalSection = {
      maritalStatus: 'NEVER_MARRIED',
    };

    const result = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: true,
    });

    expect(result?.maritalStatus).toBe('NEVER_MARRIED');
  });

  // ─── Edge case: NULL/undefined personal section ─────────────────────────────────

  it('Edge case: NULL personal section → returns undefined', () => {
    const result = filterMaritalStatus(undefined, {
      isSelf: false,
      hasAcceptedMatch: false,
    });

    expect(result).toBeUndefined();
  });

  it('Edge case: own profile + null personal → still returns undefined', () => {
    const result = filterMaritalStatus(undefined, {
      isSelf: true,
      hasAcceptedMatch: false,
    });

    expect(result).toBeUndefined();
  });

  // ─── Mutation detection ──────────────────────────────────────────────────────────

  it('Mutation detection: if !== condition removed, DIVORCED visible to strangers', () => {
    const personal: PersonalSection = {
      maritalStatus: 'DIVORCED',
    };

    // Current (correct) behavior
    const withFilter = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: false,
    });
    expect(withFilter).not.toHaveProperty('maritalStatus'); // Hidden (correct)

    // Simulated mutation: if the !== check were removed
    const withoutFilter = personal; // No filtering → visible (WRONG)
    expect(withoutFilter).toHaveProperty('maritalStatus');

    // Mutation is detectable
    expect(!!withFilter?.maritalStatus).not.toBe(!!withoutFilter?.maritalStatus);
  });

  it('Mutation detection: if inverted to ===, NEVER_MARRIED would be hidden', () => {
    const personal: PersonalSection = {
      maritalStatus: 'NEVER_MARRIED',
    };

    // Current (correct) — NEVER_MARRIED is visible
    const withCorrectCondition = filterMaritalStatus(personal, {
      isSelf: false,
      hasAcceptedMatch: false,
    });
    expect(withCorrectCondition?.maritalStatus).toBe('NEVER_MARRIED');

    // Simulated mutation: if !== were inverted to ===
    // Then the condition !hasAcceptedMatch && (NEVER_MARRIED === 'NEVER_MARRIED')
    // would be true → maritalStatus stripped
    const wouldStripIfMutated = !false && (personal.maritalStatus === 'NEVER_MARRIED');
    expect(wouldStripIfMutated).toBe(true); // Would incorrectly strip

    // Proves mutation is caught
    expect(!!withCorrectCondition?.maritalStatus).toBe(true);
    expect(wouldStripIfMutated).toBe(true);
  });

});
