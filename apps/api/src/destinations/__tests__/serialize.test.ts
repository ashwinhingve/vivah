/**
 * Destinations serializers — Phase 8 Sprint I (Unit 8.1).
 *
 * Pure row → wire mapping, no database. Two things here are load-bearing rather
 * than cosmetic:
 *   * `date` columns arrive from drizzle as 'YYYY-MM-DD' STRINGS. An earlier
 *     draft called .toISOString() on them, which is both a compile error and a
 *     runtime crash — these tests pin the string-passthrough.
 *   * The travel serializer must expose guest name and side and NOTHING else.
 *     `guests` also holds phone and email (CLAUDE.md rule 5).
 */

import { describe, it, expect } from 'vitest';
import { serializeDestination, serializeSummary, serializeTravelLeg, serializeCeremony } from '../serialize.js';

const NOW = new Date('2026-07-18T10:00:00.000Z');

const legRow = {
  id: 'd1', weddingId: 'w1', city: 'Udaipur', countryCode: 'IN',
  ianaTimezone: 'Asia/Kolkata', arriveOn: '2026-12-04', departOn: '2026-12-07',
  sortOrder: 1, isPrimary: true, notes: 'Lake side',
  createdAt: NOW, updatedAt: NOW,
};

const travelRow = {
  id: 't1', destinationId: 'd1', guestId: 'g1',
  arrivalDate: '2026-12-04', arrivalTime: '14:30',
  departureDate: '2026-12-07', departureTime: '09:00',
  travelNotes: 'Flying from Mumbai', createdAt: NOW, updatedAt: NOW,
};

describe('serializeDestination', () => {
  it('passes date columns through as YYYY-MM-DD strings', () => {
    const out = serializeDestination(legRow);
    expect(out.arriveOn).toBe('2026-12-04');
    expect(out.departOn).toBe('2026-12-07');
  });

  it('renders timestamps as ISO strings', () => {
    expect(serializeDestination(legRow).createdAt).toBe('2026-07-18T10:00:00.000Z');
  });

  it('preserves a null notes rather than coercing to empty string', () => {
    expect(serializeDestination({ ...legRow, notes: null }).notes).toBeNull();
  });
});

describe('serializeSummary', () => {
  it('carries the counts alongside the leg', () => {
    const out = serializeSummary(legRow, 3, 12);
    expect(out.ceremonyCount).toBe(3);
    expect(out.travellerCount).toBe(12);
    expect(out.city).toBe('Udaipur');
  });

  it('keeps a zero count as 0', () => {
    expect(serializeSummary(legRow, 0, 0).ceremonyCount).toBe(0);
  });
});

describe('serializeTravelLeg', () => {
  it('exposes guest name and side', () => {
    const out = serializeTravelLeg(travelRow, 'Asha Menon', 'BRIDE');
    expect(out.guestName).toBe('Asha Menon');
    expect(out.guestSide).toBe('BRIDE');
    expect(out.arrivalTime).toBe('14:30');
  });

  it('never leaks a phone or email field', () => {
    const out = serializeTravelLeg(travelRow, 'Asha Menon', 'BRIDE');
    const keys = Object.keys(out);
    expect(keys).not.toContain('phone');
    expect(keys).not.toContain('email');
    expect(JSON.stringify(out)).not.toMatch(/@|\+91/);
  });

  it('tolerates an unknown side', () => {
    expect(serializeTravelLeg(travelRow, 'X', null).guestSide).toBeNull();
  });
});

describe('serializeCeremony outsideWindow', () => {
  const win = { arriveOn: '2026-12-04', departOn: '2026-12-07' };
  const cer = (date: string | null) => ({ id: 'c1', type: 'HALDI', date, venue: null });

  it('is false inside the window', () => {
    expect(serializeCeremony(cer('2026-12-05'), win.arriveOn, win.departOn).outsideWindow).toBe(false);
  });

  it('is false on the boundary days (inclusive)', () => {
    expect(serializeCeremony(cer('2026-12-04'), win.arriveOn, win.departOn).outsideWindow).toBe(false);
    expect(serializeCeremony(cer('2026-12-07'), win.arriveOn, win.departOn).outsideWindow).toBe(false);
  });

  it('is true before arrival and after departure', () => {
    expect(serializeCeremony(cer('2026-12-03'), win.arriveOn, win.departOn).outsideWindow).toBe(true);
    expect(serializeCeremony(cer('2026-12-08'), win.arriveOn, win.departOn).outsideWindow).toBe(true);
  });

  it('is false when the ceremony has no date yet (a placeholder is not a problem)', () => {
    expect(serializeCeremony(cer(null), win.arriveOn, win.departOn).outsideWindow).toBe(false);
  });

  it('compares across a year boundary correctly', () => {
    expect(serializeCeremony(cer('2027-01-02'), '2026-12-30', '2027-01-03').outsideWindow).toBe(false);
    expect(serializeCeremony(cer('2027-01-04'), '2026-12-30', '2027-01-03').outsideWindow).toBe(true);
  });
});
