import { describe, it, expect } from 'vitest';
import { normalizeRashi, normalizeNakshatra, normalizeManglik } from '../horoscope.js';
import { RASHI_VALUES, NAKSHATRA_VALUES } from '@smartshaadi/schemas';

describe('normalizeRashi', () => {
  it('maps every value the write path can store', () => {
    // This is the assertion that matters. `packages/schemas` validates
    // horoscope writes against RASHI_VALUES, so anything in that enum WILL
    // reach us — and an unmapped value does not error, it silently scores 0
    // in the Python calculator. If someone adds a rashi to the enum without
    // adding it here, this fails instead of shipping wrong compatibility.
    for (const v of RASHI_VALUES) {
      expect(normalizeRashi(v), `enum value ${v} is unmapped`).not.toBeNull();
    }
  });

  it('translates the DB enum to the Sanskrit the calculator keys on', () => {
    expect(normalizeRashi('TULA')).toBe('Tula');
    expect(normalizeRashi('MESH')).toBe('Mesha');
  });

  it('handles the enum forms that are not just an uppercase Sanskrit spelling', () => {
    // These differ by more than case, so a toLowerCase()+capitalise shortcut
    // would silently produce an unrecognised value.
    expect(normalizeRashi('MITHUN')).toBe('Mithuna');
    expect(normalizeRashi('KARK')).toBe('Karka');
    expect(normalizeRashi('SINGH')).toBe('Simha');
    expect(normalizeRashi('VRISHCHIK')).toBe('Vrishchika');
    expect(normalizeRashi('MAKAR')).toBe('Makara');
    expect(normalizeRashi('KUMBH')).toBe('Kumbha');
    expect(normalizeRashi('MEEN')).toBe('Meena');
  });

  it('passes through values already in Sanskrit (seeded data)', () => {
    expect(normalizeRashi('Tula')).toBe('Tula');
    expect(normalizeRashi('Mesha')).toBe('Mesha');
  });

  it('returns null for junk rather than defaulting to a real rashi', () => {
    // 'Various' is genuinely present in seeded data. A default here would
    // produce a plausible score belonging to nobody.
    expect(normalizeRashi('Various')).toBeNull();
    expect(normalizeRashi('')).toBeNull();
    expect(normalizeRashi('   ')).toBeNull();
    expect(normalizeRashi(null)).toBeNull();
    expect(normalizeRashi(undefined)).toBeNull();
    expect(normalizeRashi(42)).toBeNull();
  });
});

describe('normalizeNakshatra', () => {
  it('maps every value the write path can store', () => {
    for (const v of NAKSHATRA_VALUES) {
      expect(normalizeNakshatra(v), `enum value ${v} is unmapped`).not.toBeNull();
    }
  });

  it('translates underscored enum values to spaced Sanskrit', () => {
    expect(normalizeNakshatra('PURVA_PHALGUNI')).toBe('Purva Phalguni');
    expect(normalizeNakshatra('UTTARA_BHADRAPADA')).toBe('Uttara Bhadrapada');
  });

  it('accepts the spaced form too', () => {
    expect(normalizeNakshatra('Purva Phalguni')).toBe('Purva Phalguni');
    expect(normalizeNakshatra('PURVA PHALGUNI')).toBe('Purva Phalguni');
  });

  it('handles the DHANISHTA / Dhanishtha spelling difference', () => {
    // The enum drops the trailing 'h' the calculator expects.
    expect(normalizeNakshatra('DHANISHTA')).toBe('Dhanishtha');
    expect(normalizeNakshatra('Dhanishtha')).toBe('Dhanishtha');
  });

  it('returns null for junk', () => {
    expect(normalizeNakshatra('Various')).toBeNull();
    expect(normalizeNakshatra(null)).toBeNull();
  });
});

describe('normalizeManglik', () => {
  it('accepts the boolean form older documents store', () => {
    expect(normalizeManglik(true)).toBe('YES');
    expect(normalizeManglik(false)).toBe('NO');
  });

  it('accepts the string form newer documents store', () => {
    expect(normalizeManglik('YES')).toBe('YES');
    expect(normalizeManglik('PARTIAL')).toBe('PARTIAL');
    expect(normalizeManglik('NO')).toBe('NO');
  });

  it('treats anything unrecognised as NO', () => {
    // Absence of a recorded dosha is not evidence of one.
    expect(normalizeManglik(null)).toBe('NO');
    expect(normalizeManglik(undefined)).toBe('NO');
    expect(normalizeManglik('maybe')).toBe('NO');
  });
});
