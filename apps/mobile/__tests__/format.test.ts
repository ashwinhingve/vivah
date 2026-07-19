import {
  formatDate,
  formatINR,
  formatINRCompact,
  formatPriceRange,
} from '../src/lib/format';

/**
 * These assertions pin the UNITS as much as the formatting. Every amount that
 * reaches mobile is in rupees; if someone later "fixes" a screen by dividing by
 * 100, these fail loudly rather than shipping a 100x price error.
 */
describe('formatINR', () => {
  it('formats rupees with Indian grouping', () => {
    expect(formatINR(118000)).toBe('₹1,18,000');
    expect(formatINR(2500)).toBe('₹2,500');
  });

  it('accepts the decimal STRINGS the invoice API returns', () => {
    expect(formatINR('118000.00')).toBe('₹1,18,000');
  });

  it('keeps the sign for money out', () => {
    expect(formatINR(-25000)).toBe('-₹25,000');
  });

  it('renders an em dash for missing or unparseable values', () => {
    expect(formatINR(null)).toBe('—');
    expect(formatINR(undefined)).toBe('—');
    expect(formatINR('')).toBe('—');
    expect(formatINR('not-a-number')).toBe('—');
  });

  it('does not treat 0 as missing', () => {
    expect(formatINR(0)).toBe('₹0');
  });
});

// The two-decimal form ("₹2.50 L", not "₹2.5 L") is deliberate: it is exactly
// what formatINRCompact in apps/web/src/lib/format.ts produces. The same vendor
// must show the same price in the app and on the site, and a prettier-but-
// different mobile rendering is the kind of mismatch users report as a bug.
describe('formatINRCompact', () => {
  it('uses lakh and crore, not thousands, above 1L', () => {
    expect(formatINRCompact(250000)).toBe('₹2.50 L');
    expect(formatINRCompact(800000)).toBe('₹8 L');
    expect(formatINRCompact(2_50_00_000)).toBe('₹2.50 Cr');
  });

  it('drops the decimals on an exact multiple', () => {
    expect(formatINRCompact(1_00_000)).toBe('₹1 L');
    expect(formatINRCompact(1_00_00_000)).toBe('₹1 Cr');
  });

  it('uses k below a lakh', () => {
    expect(formatINRCompact(25000)).toBe('₹25k');
  });

  it('leaves small amounts ungrouped', () => {
    expect(formatINRCompact(750)).toBe('₹750');
  });

  it('keeps the sign on negatives', () => {
    expect(formatINRCompact(-250000)).toBe('-₹2.50 L');
  });
});

describe('formatPriceRange', () => {
  it('renders both ends of the band', () => {
    expect(formatPriceRange(250000, 800000)).toBe('₹2.50 L – ₹8 L');
  });

  it('collapses to one value when the ends match', () => {
    expect(formatPriceRange(250000, 250000)).toBe('₹2.50 L');
  });

  it('handles a one-sided band', () => {
    expect(formatPriceRange(250000, null)).toBe('From ₹2.50 L');
    expect(formatPriceRange(null, 800000)).toBe('Up to ₹8 L');
  });

  it('returns null when there is no price at all, so the caller can say so', () => {
    expect(formatPriceRange(null, null)).toBeNull();
    expect(formatPriceRange(undefined, undefined)).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats an ISO timestamp', () => {
    expect(formatDate('2026-03-12T00:00:00.000Z')).toBe('12 Mar 2026');
  });

  it('returns null for missing or unparseable input', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate('')).toBeNull();
    expect(formatDate('nonsense')).toBeNull();
  });
});
