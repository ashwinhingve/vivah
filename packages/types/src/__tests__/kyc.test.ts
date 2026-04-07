import { describe, it, expect } from 'vitest';
import { KycErrorCode } from '../kyc.js';

describe('KycErrorCode', () => {
  it('has all required error codes', () => {
    const expected = [
      'PROFILE_NOT_FOUND',
      'KYC_ALREADY_VERIFIED',
      'KYC_IN_REVIEW',
      'KYC_REJECTED',
      'DUPLICATE_ACCOUNT_DETECTED',
      'PHOTO_FRAUD_DETECTED',
      'AADHAAR_VERIFICATION_FAILED',
    ];
    expected.forEach(code => {
      expect(KycErrorCode).toHaveProperty(code);
      expect(KycErrorCode[code as keyof typeof KycErrorCode]).toBe(code);
    });
  });
});
