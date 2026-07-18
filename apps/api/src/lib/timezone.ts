/**
 * Timezone utilities for NRI-aware scheduling — Phase 7 Sprint G, Unit 7.2.
 *
 * Native Intl.DateTimeFormat API; no dependencies. DST-correct for all zones.
 * Node 22.13 ships full ICU (417 IANA zones verified).
 *
 * Reuses IanaTimezoneSchema validation from @smartshaadi/schemas/nri.ts.
 */

import { IanaTimezoneSchema } from '@smartshaadi/schemas';

/** Validate an IANA timezone string defensively. */
export function validateTimezone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  try {
    IanaTimezoneSchema.parse(tz);
    return true;
  } catch {
    return false;
  }
}

/**
 * Country → representative IANA timezone mapping for NRI/international users.
 *
 * For countries spanning multiple zones (US, CA, AU), this returns a REPRESENTATIVE
 * zone. Users with an explicit `ianaTimezone` always win — this is only the fallback.
 *
 * Coverage: IN, US, CA, GB, AE, AU, SG, NZ, DE, plus documented fallback.
 */
export function inferTimezoneFromCountry(iso2: string): string {
  const countryMap: Record<string, string> = {
    // ── Primary markets ──────────────────────────────────────────────────
    IN: 'Asia/Kolkata',        // India (single zone)

    // ── NRI strongholds (North America) ──────────────────────────────────
    US: 'America/New_York',    // Representative (East Coast — financial center + largest diaspora)
                                // Note: US spans 6 zones; for a shared overlap window this is reasonable
    CA: 'America/Toronto',      // Representative (Ontario — largest population)
                                // Note: CA spans 6 zones; Toronto is a common NRI hub

    // ── NRI strongholds (Europe & Middle East) ───────────────────────────
    GB: 'Europe/London',        // UK (single zone)
    DE: 'Europe/Berlin',        // Germany (single zone)
    AE: 'Asia/Dubai',           // UAE — growing NRI population

    // ── NRI strongholds (Asia-Pacific) ───────────────────────────────────
    AU: 'Australia/Sydney',     // Representative (NSW — largest population)
                                // Note: AU spans 3 zones; Sydney is the most common NRI hub
    SG: 'Asia/Singapore',       // Singapore (single zone)
    NZ: 'Pacific/Auckland',     // New Zealand (single zone, excluding Chatham)
  };

  return countryMap[iso2] ?? 'Asia/Kolkata'; // Default to India timezone
}

/**
 * Extract timezone from a profile object.
 * Returns explicit ianaTimezone if set, otherwise infers from countryOfResidence.
 *
 * @param profile Object with { ianaTimezone?: string | null; countryOfResidence?: string }
 * @returns Valid IANA timezone string, or 'Asia/Kolkata' if all inference fails
 */
export function resolveTimezone(profile: {
  ianaTimezone?: string | null;
  countryOfResidence?: string;
}): string {
  // Explicit timezone always wins
  if (profile.ianaTimezone && validateTimezone(profile.ianaTimezone)) {
    return profile.ianaTimezone;
  }

  // Fall back to country inference
  if (profile.countryOfResidence) {
    const inferred = inferTimezoneFromCountry(profile.countryOfResidence);
    if (validateTimezone(inferred)) {
      return inferred;
    }
  }

  // Ultimate fallback
  return 'Asia/Kolkata';
}

/**
 * Render a UTC Date in a specific timezone.
 *
 * @param date UTC Date to render
 * @param ianaTz IANA timezone (e.g. 'America/Toronto')
 * @param opts Optional Intl.DateTimeFormatOptions (e.g. { year: '2-digit', month: 'short', ... })
 * @returns Localized date string, or null if timezone is invalid
 *
 * @example
 *   formatInZone(new Date('2026-03-15T14:30:00Z'), 'America/Toronto')
 *   // → '3/15/2026, 10:30:00 AM' (EST, UTC-5)
 */
export function formatInZone(
  date: Date,
  ianaTz: string,
  opts?: Intl.DateTimeFormatOptions,
): string | null {
  if (!validateTimezone(ianaTz)) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: ianaTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        ...opts,
      },
    );
    return formatter.format(date);
  } catch {
    return null;
  }
}

/**
 * Get timezone offset (in minutes) for a given timezone at a specific moment.
 *
 * This correctly handles DST — the offset is computed for the given instant,
 * not cached as a fixed value.
 *
 * @param date Instant (any timezone; interpretation is always UTC)
 * @param ianaTz IANA timezone
 * @returns Offset in minutes (e.g., 330 for IST = UTC+5:30), or null if invalid
 *         Positive means ahead of UTC, negative means behind UTC.
 *
 * @example
 *   getOffsetMinutes(new Date('2026-01-15T00:00:00Z'), 'America/Toronto')
 *   // → -300 (EST in January = UTC-5)
 *
 *   getOffsetMinutes(new Date('2026-07-15T00:00:00Z'), 'America/Toronto')
 *   // → -240 (EDT in July = UTC-4)
 *
 *   getOffsetMinutes(new Date('2026-01-15T00:00:00Z'), 'Asia/Kolkata')
 *   // → 330 (IST = UTC+5:30)
 */
export function getOffsetMinutes(date: Date, ianaTz: string): number | null {
  if (!validateTimezone(ianaTz)) {
    return null;
  }

  try {
    // Create formatter to extract parts in the target timezone
    const tzFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: ianaTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = tzFormatter.formatToParts(date);
    const partsObj: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        partsObj[part.type] = part.value;
      }
    }

    // Parse the local date as if it were UTC (this gives us the local time value)
    const tzDate = new Date(
      `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}Z`,
    );

    // Offset = (local date - UTC date) in milliseconds, converted to minutes
    // If local is ahead of UTC, offset is positive; if behind, offset is negative
    const offsetMs = tzDate.getTime() - date.getTime();
    return Math.round(offsetMs / 60000);
  } catch {
    return null;
  }
}

/**
 * Civil-hours overlap window for two timezones.
 *
 * Considers 08:00–22:00 local time as "reasonable hours" (morning–evening).
 * Returns the UTC interval where BOTH participants are in reasonable hours,
 * or null if there is no overlap.
 *
 * @param tzA First timezone (e.g., 'Asia/Kolkata')
 * @param tzB Second timezone (e.g., 'America/Toronto')
 * @returns { startUtc: Date; endUtc: Date } spanning at least 1 min of overlap, or null
 *
 * @example
 *   // India (UTC+5:30) vs US East Coast (UTC-5 in winter)
 *   // India 08:00–22:00 = UTC 02:30–16:30
 *   // US East 08:00–22:00 = UTC 13:00–03:00 (next day)
 *   // Overlap: UTC 13:00–16:30 ≈ 3.5 hours
 *   overlapHours('Asia/Kolkata', 'America/New_York')
 *   // → { startUtc, endUtc, label: '...' }
 */
export interface OverlapWindow {
  startUtc: Date;
  endUtc: Date;
  label: string; // Human-readable description, e.g. "13:00–16:30 UTC (0h 30m overlap)"
}

export function overlapHours(tzA: string, tzB: string): OverlapWindow | null {
  // Validate both timezones
  if (!validateTimezone(tzA) || !validateTimezone(tzB)) {
    return null;
  }

  // Use a reference date in winter (no DST issues mid-zone, and consistent offsets)
  // Then verify with a summer date to catch DST transitions.
  const checkDates = [
    new Date('2026-01-15T12:00:00Z'), // Winter
    new Date('2026-07-15T12:00:00Z'), // Summer (DST in Northern Hemisphere)
  ];

  let maxOverlapMinutes = 0;
  let bestOverlap: OverlapWindow | null = null;

  for (const refDate of checkDates) {
    const offsetAMin = getOffsetMinutes(refDate, tzA);
    const offsetBMin = getOffsetMinutes(refDate, tzB);

    if (offsetAMin === null || offsetBMin === null) {
      continue;
    }

    // Civil hours: 08:00–22:00 local = 8*60 – 22*60 minutes from midnight
    const civilStart = 8 * 60;
    const civilEnd = 22 * 60;

    // Convert to UTC (subtract offset)
    // Offset is timezone offset (positive means ahead of UTC)
    // If local is 08:00 and offset is +330 (IST), UTC is 08:00 - 330 = -322 (previous day, 03:30)
    // If local is 08:00 and offset is -300 (EST), UTC is 08:00 - (-300) = 08:00 + 300 = 13:00
    const utcStartA = civilStart - offsetAMin;
    const utcEndA = civilEnd - offsetAMin;
    const utcStartB = civilStart - offsetBMin;
    const utcEndB = civilEnd - offsetBMin;

    // Normalize to [0, 1440) range (minutes in a 24h day)
    const normalize = (m: number): number => {
      const norm = m % 1440;
      return norm < 0 ? norm + 1440 : norm;
    };

    const normStartA = normalize(utcStartA);
    const normEndA = normalize(utcEndA);
    const normStartB = normalize(utcStartB);
    const normEndB = normalize(utcEndB);

    // Find overlap
    // Special case: if a range wraps midnight (end < start after normalize),
    // we need to handle it as two ranges.
    const getOverlap = (s1: number, e1: number, s2: number, e2: number): number => {
      // Both ranges don't wrap
      if (s1 <= e1 && s2 <= e2) {
        const overlapStart = Math.max(s1, s2);
        const overlapEnd = Math.min(e1, e2);
        return Math.max(0, overlapEnd - overlapStart);
      }
      // s1<=e1 but s2>e2 (s2 wraps)
      if (s1 <= e1 && s2 > e2) {
        const part1 = Math.max(0, e2 - s1);
        const part2 = Math.max(0, e1 - s2);
        return part1 + part2;
      }
      // s1>e1 (s1 wraps) but s2<=e2
      if (s1 > e1 && s2 <= e2) {
        const part1 = Math.max(0, e1 - s2);
        const part2 = Math.max(0, e2 - s1);
        return part1 + part2;
      }
      // Both wrap
      if (s1 > e1 && s2 > e2) {
        const overlapStart = Math.max(s1, s2);
        const overlapEnd = Math.min(e1, e2);
        return Math.max(0, overlapEnd - overlapStart);
      }
      return 0;
    };

    const overlapMin = getOverlap(normStartA, normEndA, normStartB, normEndB);

    if (overlapMin > maxOverlapMinutes) {
      maxOverlapMinutes = overlapMin;

      // Compute the actual overlap window in UTC
      // For simplicity, find the first minute of overlap in the day and return as a range
      let overlapUtcStart: number | null = null;

      if (normStartA <= normEndA && normStartB <= normEndB) {
        overlapUtcStart = Math.max(normStartA, normStartB);
      } else if (normStartA <= normEndA && normStartB > normEndB) {
        // A is normal, B wraps
        if (normEndB >= normStartA) {
          overlapUtcStart = normStartA;
        } else if (normStartB <= normEndA) {
          overlapUtcStart = normStartB;
        }
      } else if (normStartA > normEndA && normStartB <= normEndB) {
        // A wraps, B is normal
        if (normEndA >= normStartB) {
          overlapUtcStart = normStartB;
        } else if (normStartA <= normEndB) {
          overlapUtcStart = normStartA;
        }
      } else {
        // Both wrap
        overlapUtcStart = Math.max(normStartA, normStartB);
      }

      if (overlapUtcStart !== null && overlapMin > 0) {
        // Use the reference date (start of day in UTC) + offset
        const dayStart = new Date(refDate);
        dayStart.setUTCHours(0, 0, 0, 0);

        const startUtc = new Date(dayStart.getTime() + overlapUtcStart * 60 * 1000);
        const endUtc = new Date(startUtc.getTime() + overlapMin * 60 * 1000);

        const hours = Math.floor(overlapMin / 60);
        const mins = overlapMin % 60;
        const label = `${String(Math.floor(overlapUtcStart / 60)).padStart(2, '0')}:${String(overlapUtcStart % 60).padStart(2, '0')}–${String(Math.floor((overlapUtcStart + overlapMin) / 60) % 24).padStart(2, '0')}:${String((overlapUtcStart + overlapMin) % 60).padStart(2, '0')} UTC (${hours}h ${mins}m overlap)`;

        bestOverlap = { startUtc, endUtc, label };
      }
    }
  }

  return bestOverlap;
}
