/**
 * Smart Shaadi — maritalStatusFilter unit tests
 */
import { describe, it, expect } from 'vitest';
import {
  passesMaritalStatusFilter,
  type MaritalStatusProfile,
} from '../filters/maritalStatusFilter.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function profile(
  overrides: Partial<MaritalStatusProfile> & { id: string },
): MaritalStatusProfile {
  return {
    maritalStatus:             'NEVER_MARRIED',
    preferredMaritalStatuses:  null,
    divorceeSupport:           false,
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('passesMaritalStatusFilter', () => {
  it('never-married + never-married: pass', () => {
    const user      = profile({ id: 'u1', maritalStatus: 'NEVER_MARRIED' });
    const candidate = profile({ id: 'u2', maritalStatus: 'NEVER_MARRIED' });
    expect(passesMaritalStatusFilter(user, candidate)).toBe(true);
  });

  it('never-married + divorced when user has no pref: filter out', () => {
    const user      = profile({ id: 'u1', maritalStatus: 'NEVER_MARRIED' });
    const candidate = profile({ id: 'u2', maritalStatus: 'DIVORCED' });
    expect(passesMaritalStatusFilter(user, candidate)).toBe(false);
  });

  it('never-married + divorced when user preferred_marital_statuses includes DIVORCED: pass', () => {
    const user      = profile({
      id: 'u1',
      maritalStatus: 'NEVER_MARRIED',
      preferredMaritalStatuses: ['DIVORCED'],
    });
    const candidate = profile({ id: 'u2', maritalStatus: 'DIVORCED' });
    expect(passesMaritalStatusFilter(user, candidate)).toBe(true);
  });

  it('widowed + never-married when widow has no pref: filter out (bilateral)', () => {
    // The NEVER_MARRIED candidate would accept the widowed user (NEVER_MARRIED
    // is universal), but the widowed user has not opted in to see NEVER_MARRIED
    // partners AND has no prefs set — however NEVER_MARRIED candidates are
    // always accepted. The block should come from the candidate side:
    // the NEVER_MARRIED candidate must also accept WIDOWED users.
    // Candidate has no prefs → does not accept WIDOWED → bilateral fail.
    const user      = profile({ id: 'u1', maritalStatus: 'WIDOWED' });
    const candidate = profile({ id: 'u2', maritalStatus: 'NEVER_MARRIED' });
    // candidate (NEVER_MARRIED, no prefs) does NOT accept user (WIDOWED)
    expect(passesMaritalStatusFilter(user, candidate)).toBe(false);
  });

  it('divorcee + divorcee when both have community_zone.divorcee_support_enabled: pass', () => {
    const user      = profile({
      id: 'u1',
      maritalStatus: 'DIVORCED',
      divorceeSupport: true,
    });
    const candidate = profile({
      id: 'u2',
      maritalStatus: 'DIVORCED',
      divorceeSupport: true,
    });
    expect(passesMaritalStatusFilter(user, candidate)).toBe(true);
  });
});
