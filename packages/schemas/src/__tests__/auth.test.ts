/**
 * Auth schema tests
 *
 * Validates PhoneSchema and VerifyOtpSchema from @smartshaadi/schemas
 * to confirm the updated regex accepts both E.164 and bare 10-digit formats.
 */
import { describe, it, expect } from 'vitest';
import { PhoneSchema, VerifyOtpSchema } from '../auth.js';

describe('PhoneSchema', () => {
  describe('valid inputs', () => {
    it('accepts E.164 format (+91XXXXXXXXXX)', () => {
      expect(PhoneSchema.safeParse('+919876543210').success).toBe(true);
    });

    it('accepts bare 10-digit number starting with 9', () => {
      expect(PhoneSchema.safeParse('9876543210').success).toBe(true);
    });

    it('accepts bare 10-digit number starting with 6', () => {
      expect(PhoneSchema.safeParse('6123456789').success).toBe(true);
    });

    it('accepts bare 10-digit number starting with 7', () => {
      expect(PhoneSchema.safeParse('7000000001').success).toBe(true);
    });

    it('accepts bare 10-digit number starting with 8', () => {
      expect(PhoneSchema.safeParse('8765432109').success).toBe(true);
    });

    it('trims surrounding whitespace', () => {
      expect(PhoneSchema.safeParse('  9876543210  ').success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects a 3-digit number', () => {
      expect(PhoneSchema.safeParse('123').success).toBe(false);
    });

    it('rejects an international number with wrong country code', () => {
      expect(PhoneSchema.safeParse('+18005551234').success).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(PhoneSchema.safeParse('').success).toBe(false);
    });

    it('rejects a number starting with 5 (invalid Indian mobile prefix)', () => {
      expect(PhoneSchema.safeParse('5123456789').success).toBe(false);
    });

    it('rejects a number starting with 1 (landline prefix)', () => {
      expect(PhoneSchema.safeParse('1234567890').success).toBe(false);
    });

    it('rejects 9-digit number (one digit short)', () => {
      expect(PhoneSchema.safeParse('987654321').success).toBe(false);
    });

    it('rejects 11-digit bare number (one too many)', () => {
      expect(PhoneSchema.safeParse('98765432100').success).toBe(false);
    });

    it('rejects +91 with invalid prefix digit after country code', () => {
      expect(PhoneSchema.safeParse('+911234567890').success).toBe(false);
    });

    it('rejects non-numeric string', () => {
      expect(PhoneSchema.safeParse('abcdefghij').success).toBe(false);
    });
  });
});

describe('VerifyOtpSchema', () => {
  describe('valid inputs', () => {
    it('accepts a 6-digit numeric OTP', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '123456',
        purpose: 'LOGIN',
      }).success).toBe(true);
    });

    it('accepts the mock OTP 123456', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '+919876543210',
        otp: '123456',
        purpose: 'REGISTRATION',
      }).success).toBe(true);
    });

    it('accepts all valid OTP purposes', () => {
      const purposes = ['LOGIN', 'REGISTRATION', 'KYC', 'CONTACT_UNLOCK', 'PASSWORD_RESET'] as const;
      for (const purpose of purposes) {
        expect(VerifyOtpSchema.safeParse({ phone: '9876543210', otp: '000000', purpose }).success).toBe(true);
      }
    });
  });

  describe('invalid inputs', () => {
    it('rejects a 5-digit OTP (too short)', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '12345',
        purpose: 'LOGIN',
      }).success).toBe(false);
    });

    it('rejects a 7-digit OTP (too long)', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '1234567',
        purpose: 'LOGIN',
      }).success).toBe(false);
    });

    it('rejects an alphabetic OTP', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: 'abcdef',
        purpose: 'LOGIN',
      }).success).toBe(false);
    });

    it('rejects an alphanumeric OTP', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '12345a',
        purpose: 'LOGIN',
      }).success).toBe(false);
    });

    it('rejects an unknown purpose', () => {
      expect(VerifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '123456',
        purpose: 'UNKNOWN',
      }).success).toBe(false);
    });
  });
});
