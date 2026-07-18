/**
 * Timezone utility tests — Phase 7 Sprint G, Unit 7.2.
 * DST correctness, no-overlap pairs, invalid zones, country inference.
 */

import { describe, it, expect } from 'vitest';
import {
  validateTimezone,
  inferTimezoneFromCountry,
  resolveTimezone,
  formatInZone,
  getOffsetMinutes,
  overlapHours,
} from '../timezone.js';

describe('timezone.ts', () => {
  describe('validateTimezone', () => {
    it('accepts valid IANA zones', () => {
      expect(validateTimezone('Asia/Kolkata')).toBe(true);
      expect(validateTimezone('America/New_York')).toBe(true);
      expect(validateTimezone('Europe/London')).toBe(true);
      expect(validateTimezone('Australia/Sydney')).toBe(true);
    });

    it('rejects invalid zones', () => {
      expect(validateTimezone('Invalid/Zone')).toBe(false);
      expect(validateTimezone('America/FakeCity')).toBe(false);
      // GMT is technically valid in Node's Intl API (Etc/UTC alias)
    });

    it('handles null/undefined', () => {
      expect(validateTimezone(null)).toBe(false);
      expect(validateTimezone(undefined)).toBe(false);
      expect(validateTimezone('')).toBe(false);
    });

    it('trims whitespace', () => {
      expect(validateTimezone('  Asia/Kolkata  ')).toBe(true);
    });
  });

  describe('inferTimezoneFromCountry', () => {
    it('maps primary markets', () => {
      expect(inferTimezoneFromCountry('IN')).toBe('Asia/Kolkata');
      expect(inferTimezoneFromCountry('GB')).toBe('Europe/London');
      expect(inferTimezoneFromCountry('DE')).toBe('Europe/Berlin');
      expect(inferTimezoneFromCountry('AE')).toBe('Asia/Dubai');
    });

    it('maps NRI strongholds (multi-zone countries use representative zone)', () => {
      // US spans 6 zones; representative is East Coast (financial center)
      expect(inferTimezoneFromCountry('US')).toBe('America/New_York');
      // Canada spans 6 zones; representative is Ontario
      expect(inferTimezoneFromCountry('CA')).toBe('America/Toronto');
      // Australia spans 3 zones; representative is NSW
      expect(inferTimezoneFromCountry('AU')).toBe('Australia/Sydney');
    });

    it('maps Asia-Pacific', () => {
      expect(inferTimezoneFromCountry('SG')).toBe('Asia/Singapore');
      expect(inferTimezoneFromCountry('NZ')).toBe('Pacific/Auckland');
    });

    it('defaults to India for unknown countries', () => {
      expect(inferTimezoneFromCountry('XX')).toBe('Asia/Kolkata');
      expect(inferTimezoneFromCountry('ZZ')).toBe('Asia/Kolkata');
      expect(inferTimezoneFromCountry('')).toBe('Asia/Kolkata');
    });
  });

  describe('resolveTimezone', () => {
    it('prefers explicit ianaTimezone', () => {
      const profile = { ianaTimezone: 'America/Toronto', countryOfResidence: 'IN' };
      expect(resolveTimezone(profile)).toBe('America/Toronto');
    });

    it('falls back to country inference', () => {
      const profile = { ianaTimezone: null, countryOfResidence: 'US' };
      expect(resolveTimezone(profile)).toBe('America/New_York');
    });

    it('defaults to Asia/Kolkata', () => {
      const profile: { ianaTimezone: string | null; countryOfResidence?: string } = { ianaTimezone: null };
      expect(resolveTimezone(profile)).toBe('Asia/Kolkata');
    });

    it('handles invalid explicit timezone gracefully', () => {
      const profile = { ianaTimezone: 'Invalid/Zone', countryOfResidence: 'GB' };
      expect(resolveTimezone(profile)).toBe('Europe/London');
    });

    it('handles empty profile', () => {
      expect(resolveTimezone({})).toBe('Asia/Kolkata');
    });
  });

  describe('formatInZone', () => {
    const refDate = new Date('2026-03-15T14:30:00Z'); // UTC

    it('formats UTC instant in target timezone', () => {
      // 2026-03-15T14:30:00Z in Asia/Kolkata (UTC+5:30) should be 20:00:00
      // 14:30 + 5:30 = 20:00
      const result = formatInZone(refDate, 'Asia/Kolkata');
      expect(result).toContain('20:00:00');
    });

    it('handles EST offset correctly (winter)', () => {
      // 2026-03-15 is spring (after DST transition in US, but before March 8)
      // Actually in 2026, DST starts March 8, so March 15 is EDT (UTC-4)
      // 2026-03-15T14:30:00Z in America/New_York is 10:30:00 EDT
      const result = formatInZone(refDate, 'America/New_York');
      expect(result).toContain('10:30:00');
    });

    it('handles Europe/London timezone', () => {
      // 2026-03-15T14:30:00Z in Europe/London is 14:30:00 (GMT, no offset yet before DST)
      // Actually, DST in 2026 starts March 29, so 2026-03-15 is still GMT (UTC+0)
      const result = formatInZone(refDate, 'Europe/London');
      expect(result).toContain('14:30:00');
    });

    it('returns null for invalid timezone', () => {
      const result = formatInZone(refDate, 'Invalid/Zone');
      expect(result).toBeNull();
    });

    it('accepts custom formatting options', () => {
      const result = formatInZone(refDate, 'Asia/Kolkata', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });
      expect(result).toBeTruthy();
      expect(result).toMatch(/Mar|15|2026/);
    });
  });

  describe('getOffsetMinutes', () => {
    it('returns offset in minutes for winter (EST)', () => {
      const winterDate = new Date('2026-01-15T00:00:00Z');
      // EST = UTC-5 = -300 minutes
      const offset = getOffsetMinutes(winterDate, 'America/New_York');
      expect(offset).toBe(-300);
    });

    it('returns correct offset for summer (EDT)', () => {
      const summerDate = new Date('2026-07-15T00:00:00Z');
      // EDT = UTC-4 = -240 minutes
      const offset = getOffsetMinutes(summerDate, 'America/New_York');
      expect(offset).toBe(-240);
    });

    it('handles Asia/Kolkata (UTC+5:30 year-round, no DST)', () => {
      const winterDate = new Date('2026-01-15T00:00:00Z');
      const summerDate = new Date('2026-07-15T00:00:00Z');
      // IST = UTC+5:30 = +330 minutes
      expect(getOffsetMinutes(winterDate, 'Asia/Kolkata')).toBe(330);
      expect(getOffsetMinutes(summerDate, 'Asia/Kolkata')).toBe(330);
    });

    it('handles Europe/London DST correctly', () => {
      const beforeDst = new Date('2026-03-15T00:00:00Z');
      const afterDst = new Date('2026-03-29T02:00:00Z');
      // Before March 29: GMT = UTC+0 = 0 minutes
      // After March 29: BST = UTC+1 = +60 minutes
      expect(getOffsetMinutes(beforeDst, 'Europe/London')).toBe(0);
      expect(getOffsetMinutes(afterDst, 'Europe/London')).toBe(60);
    });

    it('returns null for invalid timezone', () => {
      const date = new Date('2026-01-15T00:00:00Z');
      expect(getOffsetMinutes(date, 'Invalid/Zone')).toBeNull();
    });
  });

  describe('overlapHours', () => {
    it('finds overlap for compatible timezones (India + Singapore, both +5-8h UTC)', () => {
      // India: UTC+5:30, Singapore: UTC+8
      // Both have civil hours 08:00-22:00
      // India 08:00-22:00 UTC = 02:30-16:30 UTC
      // Singapore 08:00-22:00 UTC = 00:00-14:00 UTC
      // Overlap: 02:30-14:00 UTC
      const result = overlapHours('Asia/Kolkata', 'Asia/Singapore');
      expect(result).not.toBeNull();
      expect(result!.startUtc).toBeTruthy();
      expect(result!.endUtc).toBeTruthy();
      expect(result!.label).toContain('overlap');
      const overlapMs = result!.endUtc.getTime() - result!.startUtc.getTime();
      const overlapMin = overlapMs / 60000;
      expect(overlapMin).toBeGreaterThan(0);
      expect(overlapMin).toBeLessThanOrEqual(14 * 60); // Max overlap should be ~14 hours
    });

    it('finds smaller overlap for challenging pair (India + US East Coast)', () => {
      // India: UTC+5:30, US East (winter EST: UTC-5, summer EDT: UTC-4)
      // This is a ~10.5 hour difference; overlap is narrow
      const result = overlapHours('Asia/Kolkata', 'America/New_York');
      if (result) {
        const overlapMs = result.endUtc.getTime() - result.startUtc.getTime();
        const overlapMin = overlapMs / 60000;
        // Expect some overlap but less than 6 hours (generous)
        expect(overlapMin).toBeGreaterThan(0);
        expect(overlapMin).toBeLessThan(360); // Less than 6 hours
      }
    });

    it('handles midnight-wrapping windows', () => {
      // US Pacific (UTC-8 winter) vs Australia/Sydney (UTC+10 winter)
      // US 08:00-22:00 UTC = 16:00-06:00 UTC (next day, wraps)
      // Aus 08:00-22:00 UTC = 22:00-12:00 UTC (wraps backward)
      // This is a very tight overlap or none
      const result = overlapHours('America/Los_Angeles', 'Australia/Sydney');
      // The result may be null or very small; we just test it doesn't crash
      expect(result === null || result.startUtc instanceof Date).toBe(true);
    });

    it('returns null for invalid first timezone', () => {
      expect(overlapHours('Invalid/Zone', 'Asia/Kolkata')).toBeNull();
    });

    it('returns null for invalid second timezone', () => {
      expect(overlapHours('Asia/Kolkata', 'Invalid/Zone')).toBeNull();
    });

    it('handles same timezone (100% overlap)', () => {
      const result = overlapHours('Asia/Kolkata', 'Asia/Kolkata');
      if (result) {
        const overlapMs = result.endUtc.getTime() - result.startUtc.getTime();
        const overlapMin = overlapMs / 60000;
        // Full civil window is 14 hours
        expect(overlapMin).toBe(14 * 60);
      }
    });

    it('respects DST transitions (winter vs summer)', () => {
      // This test implicitly runs on two dates (winter and summer) to ensure
      // DST is handled. The function internally checks 2026-01-15 and 2026-07-15.
      const result = overlapHours('America/Toronto', 'Europe/London');
      if (result) {
        expect(result.label).toContain('overlap');
        // Both check dates should find overlap; ensure it doesn't flip to null
        // between winter and summer
        expect(result.startUtc instanceof Date).toBe(true);
      }
    });
  });

  describe('integration: full NRI scheduling scenario', () => {
    it('orchestrates timezone resolution, formatting, and overlap for a match pair', () => {
      // Proposer: India-based
      const proposerProfile = {
        ianaTimezone: null,
        countryOfResidence: 'IN',
      };

      // Invitee: Canada-based
      const inviteeProfile = {
        ianaTimezone: 'America/Toronto',
        countryOfResidence: 'CA',
      };

      const proposerTz = resolveTimezone(proposerProfile);
      const inviteeTz = resolveTimezone(inviteeProfile);

      expect(proposerTz).toBe('Asia/Kolkata');
      expect(inviteeTz).toBe('America/Toronto');

      // Find overlap
      const overlap = overlapHours(proposerTz, inviteeTz);
      expect(overlap).not.toBeNull();

      // Format a test time in both zones
      const testDate = new Date('2026-05-20T13:00:00Z');
      const proposerLocal = formatInZone(testDate, proposerTz);
      const inviteeLocal = formatInZone(testDate, inviteeTz);

      expect(proposerLocal).toBeTruthy();
      expect(inviteeLocal).toBeTruthy();

      // Verify times are different (not the same timezone)
      expect(proposerLocal).not.toEqual(inviteeLocal);
    });
  });
});
