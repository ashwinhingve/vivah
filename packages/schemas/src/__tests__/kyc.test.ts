import { describe, it, expect } from 'vitest';
import { KycInitiateSchema, KycPhotoSchema, AdminReviewSchema, PhotoAnalysisSchema } from '../kyc.js';

describe('KycInitiateSchema', () => {
  it('accepts a valid redirectUri', () => {
    const r = KycInitiateSchema.safeParse({ redirectUri: 'https://app.smartshaadi.co.in/kyc/callback' });
    expect(r.success).toBe(true);
  });
  it('rejects non-URL redirectUri', () => {
    const r = KycInitiateSchema.safeParse({ redirectUri: 'not-a-url' });
    expect(r.success).toBe(false);
  });
});

describe('KycPhotoSchema', () => {
  it('accepts a valid r2Key', () => {
    const r = KycPhotoSchema.safeParse({ r2Key: 'profiles/abc123/photo.jpg' });
    expect(r.success).toBe(true);
  });
  it('rejects empty r2Key', () => {
    const r = KycPhotoSchema.safeParse({ r2Key: '' });
    expect(r.success).toBe(false);
  });
  it('rejects r2Key longer than 500 characters', () => {
    const r = KycPhotoSchema.safeParse({ r2Key: 'a'.repeat(501) });
    expect(r.success).toBe(false);
  });
});

describe('AdminReviewSchema', () => {
  it('accepts with optional note', () => {
    const r = AdminReviewSchema.safeParse({ note: 'Looks good' });
    expect(r.success).toBe(true);
  });
  it('accepts without note', () => {
    const r = AdminReviewSchema.safeParse({});
    expect(r.success).toBe(true);
  });
  it('rejects note longer than 1000 characters', () => {
    const r = AdminReviewSchema.safeParse({ note: 'a'.repeat(1001) });
    expect(r.success).toBe(false);
  });
});

describe('PhotoAnalysisSchema', () => {
  const valid = {
    isRealPerson:    true,
    confidenceScore: 98.5,
    hasSunglasses:   false,
    multipleFaces:   false,
    analyzedAt:      '2026-04-07T10:00:00.000Z',
  };

  it('accepts a valid Rekognition result', () => {
    const r = PhotoAnalysisSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
  it('rejects confidenceScore above 100', () => {
    const r = PhotoAnalysisSchema.safeParse({ ...valid, confidenceScore: 100.1 });
    expect(r.success).toBe(false);
  });
  it('rejects confidenceScore below 0', () => {
    const r = PhotoAnalysisSchema.safeParse({ ...valid, confidenceScore: -1 });
    expect(r.success).toBe(false);
  });
  it('rejects non-datetime analyzedAt', () => {
    const r = PhotoAnalysisSchema.safeParse({ ...valid, analyzedAt: '2026-04-07' });
    expect(r.success).toBe(false);
  });
});
