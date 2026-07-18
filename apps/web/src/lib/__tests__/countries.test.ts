/**
 * COUNTRIES integrity (Phase 7 Sprint G, Unit 7.2).
 *
 * 'AE' was listed twice, which React reported as "Encountered two children with
 * the same key" on the NRI filter chips — a warning it pairs with "children may
 * be duplicated and/or omitted". type-check, the API suite and `next build` all
 * passed with the duplicate in place; only rendering the page surfaced it.
 * This test is the cheap standing check that replaces needing a browser to
 * notice it again.
 */
import { describe, it, expect } from 'vitest';
import { COUNTRIES } from '../countries';

describe('COUNTRIES', () => {
  it('has no duplicate country codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    const seen = new Set<string>();
    const dupes = codes.filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
    expect(dupes, `duplicate country codes: ${dupes.join(', ')}`).toEqual([]);
  });

  it('has no duplicate display names', () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses valid uppercase ISO 3166-1 alpha-2 codes', () => {
    // The feed facet compares these against profiles.country_of_residence, which
    // the API stores uppercased — a lowercase entry here would silently never match.
    for (const { code } of COUNTRIES) {
      expect(code, `bad code: ${code}`).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('includes India — the platform default residence', () => {
    expect(COUNTRIES.some((c) => c.code === 'IN')).toBe(true);
  });
});
