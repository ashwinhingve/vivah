import { describe, it, expect } from 'vitest';
import { KycInitiateSchema, KycPhotoSchema, AdminReviewSchema } from '../kyc.js';

describe('KycInitiateSchema', () => {
  it('accepts a valid redirectUri', () => {
    const r = KycInitiateSchema.safeParse({ redirectUri: 'https://app.vivah.in/kyc/callback' });
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
});
