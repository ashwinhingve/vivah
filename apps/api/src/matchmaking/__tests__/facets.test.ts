/**
 * Match feed facets (Phase 7 Sprint G, Unit 7.2 follow-up).
 *
 * These exist because the /nri browse page shipped requesting `?nriOnly=true`
 * against a schema that did not parse it. Zod strips unknown keys, so the flag
 * was silently discarded and the page rendered the ORDINARY feed under an NRI
 * heading — presenting domestic profiles as cross-border ones.
 *
 * The first test below is the one that would have caught that.
 */
import { describe, it, expect } from 'vitest';
import { applyFeedFacets } from '../facets.js';
import type { CompatibilityScore, MatchFeedItem } from '@smartshaadi/types';

const compatibility: CompatibilityScore = {
  totalScore: 80,
  breakdown: {} as CompatibilityScore['breakdown'],
  gunaScore: 24,
  tier: 'good',
  flags: [],
};

const item = (profileId: string, countryOfResidence: string | null): MatchFeedItem => ({
  profileId,
  name: profileId,
  age: 30,
  city: 'City',
  compatibility,
  photoKey: null,
  isNew: false,
  isVerified: true,
  photoHidden: false,
  shortlisted: false,
  countryOfResidence,
});

const feed = [
  item('domestic-1', 'IN'),
  item('canada', 'CA'),
  item('usa', 'US'),
  item('domestic-2', 'IN'),
  item('unknown', null),
];

describe('applyFeedFacets — nriOnly', () => {
  it('excludes profiles in the viewer’s own country', () => {
    const out = applyFeedFacets(feed, { nriOnly: true }, 'IN');
    expect(out.map((i) => i.profileId)).toEqual(['canada', 'usa']);
  });

  it('is relative to the viewer, not absolute — a Toronto user sees the Indians', () => {
    // "NRI" means "abroad relative to me". If this returned CA profiles for a
    // CA viewer, the page would mean something different on each side of a pair.
    const out = applyFeedFacets(feed, { nriOnly: true }, 'CA');
    expect(out.map((i) => i.profileId)).toEqual(['domestic-1', 'usa', 'domestic-2']);
  });

  it('excludes profiles whose country is unknown', () => {
    // A profile we cannot place must never be shown under an NRI heading.
    const out = applyFeedFacets(feed, { nriOnly: true }, 'IN');
    expect(out.find((i) => i.profileId === 'unknown')).toBeUndefined();
  });

  it('falls back to not-IN when the viewer’s own country is unknown', () => {
    const out = applyFeedFacets(feed, { nriOnly: true }, null);
    expect(out.map((i) => i.profileId)).toEqual(['canada', 'usa']);
  });

  it('compares case-insensitively', () => {
    const mixed = [item('lower', 'ca'), item('home', 'in')];
    const out = applyFeedFacets(mixed, { nriOnly: true }, 'IN');
    expect(out.map((i) => i.profileId)).toEqual(['lower']);
  });
});

describe('applyFeedFacets — countries allow-list', () => {
  it('narrows to the listed countries', () => {
    const out = applyFeedFacets(feed, { countries: ['CA'] }, 'IN');
    expect(out.map((i) => i.profileId)).toEqual(['canada']);
  });

  it('combines with nriOnly', () => {
    const out = applyFeedFacets(feed, { nriOnly: true, countries: ['US'] }, 'IN');
    expect(out.map((i) => i.profileId)).toEqual(['usa']);
  });
});

describe('applyFeedFacets — inertness on the ordinary feed', () => {
  it('returns the feed untouched when no facet is active', () => {
    // The plain feed path must be unaffected — same array, same order.
    expect(applyFeedFacets(feed, {}, 'IN')).toBe(feed);
    expect(applyFeedFacets(feed, { nriOnly: false, countries: [] }, 'IN')).toBe(feed);
  });
});
