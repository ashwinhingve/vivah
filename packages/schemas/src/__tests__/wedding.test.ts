import { describe, it, expect } from 'vitest';
import {
  CreateWeddingSchema,
  UpdateWeddingSchema,
  CreateCeremonySchema,
  UpdateCeremonySchema,
} from '../wedding.js';

function isoOffsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('CreateWeddingSchema — future date validation', () => {
  it('rejects a wedding date in the past', () => {
    const r = CreateWeddingSchema.safeParse({ weddingDate: isoOffsetDays(-3) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('Wedding date must be in the future');
    }
  });

  it("rejects today's date (event already begun)", () => {
    const r = CreateWeddingSchema.safeParse({ weddingDate: isoOffsetDays(0) });
    expect(r.success).toBe(false);
  });

  it('accepts a future wedding date with a separate weddingName', () => {
    const r = CreateWeddingSchema.safeParse({
      weddingName: 'Priya & Rahul',
      weddingDate: isoOffsetDays(120),
      venueName: 'The Orchid Hotel, Indore',
    });
    expect(r.success).toBe(true);
  });

  it('accepts an empty object (date optional)', () => {
    expect(CreateWeddingSchema.safeParse({}).success).toBe(true);
  });

  it('UpdateWeddingSchema also rejects past dates', () => {
    expect(UpdateWeddingSchema.safeParse({ weddingDate: isoOffsetDays(-1) }).success).toBe(false);
  });
});

describe('CreateCeremonySchema — custom type + future date', () => {
  it('rejects a past ceremony date', () => {
    const r = CreateCeremonySchema.safeParse({ type: 'HALDI', date: isoOffsetDays(-1) });
    expect(r.success).toBe(false);
  });

  it('requires customTypeName when type is OTHER', () => {
    const r = CreateCeremonySchema.safeParse({ type: 'OTHER' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain('customTypeName');
    }
  });

  it('accepts OTHER with a custom name like "Manda"', () => {
    const r = CreateCeremonySchema.safeParse({
      type: 'OTHER',
      customTypeName: 'Manda',
      date: isoOffsetDays(30),
    });
    expect(r.success).toBe(true);
  });

  it('accepts new TILAK and SAGAN ceremony types', () => {
    expect(CreateCeremonySchema.safeParse({ type: 'TILAK' }).success).toBe(true);
    expect(CreateCeremonySchema.safeParse({ type: 'SAGAN' }).success).toBe(true);
  });

  it('no longer accepts an endTime field as schema-validated input', () => {
    const r = CreateCeremonySchema.safeParse({ type: 'HALDI', endTime: '13:00' });
    // endTime is stripped/ignored — parse still succeeds, but the value is absent.
    expect(r.success).toBe(true);
    if (r.success) {
      expect('endTime' in r.data).toBe(false);
    }
  });

  it('UpdateCeremonySchema stays partial and rejects past dates', () => {
    expect(UpdateCeremonySchema.safeParse({}).success).toBe(true);
    expect(UpdateCeremonySchema.safeParse({ date: isoOffsetDays(-2) }).success).toBe(false);
  });
});
