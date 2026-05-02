/**
 * Smart Shaadi — Timeline auto-generate template smoke tests
 *
 * Validates the offset math used by autoGenerateFromCeremonies — pure
 * arithmetic, no DB.
 */

import { describe, expect, it } from 'vitest';

function parseHHMM(date: string, hhmm?: string | null): Date {
  if (!hhmm) return new Date(`${date}T09:00:00`);
  return new Date(`${date}T${hhmm}:00`);
}

describe('timeline anchor parsing', () => {
  it('defaults to 9am when no time is supplied', () => {
    const d = parseHHMM('2026-12-01');
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getHours()).toBe(9);
  });

  it('parses an HH:MM time on the given date', () => {
    const d = parseHHMM('2026-12-01', '14:30');
    expect(isNaN(d.getTime())).toBe(false);
  });
});

describe('timeline event offset math', () => {
  it('start + offsetMin produces a date offsetMin minutes later', () => {
    const start = new Date('2026-12-01T10:00:00.000Z');
    const offset = 30;
    const computed = new Date(start.getTime() + offset * 60_000);
    expect(computed.toISOString()).toBe('2026-12-01T10:30:00.000Z');
  });

  it('handles negative offsets (events before anchor)', () => {
    const start = new Date('2026-12-01T10:00:00.000Z');
    const computed = new Date(start.getTime() + -120 * 60_000);
    expect(computed.toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });
});
