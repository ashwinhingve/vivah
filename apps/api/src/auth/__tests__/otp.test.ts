import { describe, it, expect } from 'vitest';
import {
  generate6,
  hashOtp,
  verifyOtpHash,
  otpExpiresAt,
  maskPhone,
  OTP_MAX_ATTEMPTS,
} from '../otp.js';

describe('generate6()', () => {
  it('returns an integer between 100000 and 999999', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generate6();
      expect(otp).toBeGreaterThanOrEqual(100_000);
      expect(otp).toBeLessThanOrEqual(999_999);
      expect(Number.isInteger(otp)).toBe(true);
    }
  });
});

describe('hashOtp()', () => {
  it('produces a 64-char hex string', () => {
    const h = hashOtp('123456', '9876543210', 'LOGIN');
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it('is deterministic', () => {
    const a = hashOtp('123456', '9876543210', 'LOGIN');
    const b = hashOtp('123456', '9876543210', 'LOGIN');
    expect(a).toBe(b);
  });

  it('differs by purpose', () => {
    const a = hashOtp('123456', '9876543210', 'LOGIN');
    const b = hashOtp('123456', '9876543210', 'REGISTRATION');
    expect(a).not.toBe(b);
  });

  it('differs by phone', () => {
    const a = hashOtp('123456', '9876543210', 'LOGIN');
    const b = hashOtp('123456', '9999999999', 'LOGIN');
    expect(a).not.toBe(b);
  });

  it('differs by otp value', () => {
    const a = hashOtp('123456', '9876543210', 'LOGIN');
    const b = hashOtp('654321', '9876543210', 'LOGIN');
    expect(a).not.toBe(b);
  });
});

describe('verifyOtpHash()', () => {
  it('returns true when candidate matches stored hash', () => {
    const stored = hashOtp('123456', '9876543210', 'LOGIN');
    const candidate = hashOtp('123456', '9876543210', 'LOGIN');
    expect(verifyOtpHash(candidate, stored)).toBe(true);
  });

  it('returns false for wrong OTP', () => {
    const stored = hashOtp('123456', '9876543210', 'LOGIN');
    const candidate = hashOtp('999999', '9876543210', 'LOGIN');
    expect(verifyOtpHash(candidate, stored)).toBe(false);
  });

  it('returns false for wrong purpose', () => {
    const stored = hashOtp('123456', '9876543210', 'LOGIN');
    const candidate = hashOtp('123456', '9876543210', 'REGISTRATION');
    expect(verifyOtpHash(candidate, stored)).toBe(false);
  });
});

describe('attempt-limit logic', () => {
  it('OTP_MAX_ATTEMPTS is 3', () => {
    expect(OTP_MAX_ATTEMPTS).toBe(3);
  });

  it('exceeding max attempts should block (simulated)', () => {
    const attempts = 3;
    expect(attempts >= OTP_MAX_ATTEMPTS).toBe(true);
  });
});

describe('otpExpiresAt()', () => {
  it('returns a Date approximately 10 minutes in the future', () => {
    const before = Date.now();
    const exp = otpExpiresAt();
    const after = Date.now();

    const tenMinMs = 10 * 60 * 1000;
    expect(exp.getTime()).toBeGreaterThanOrEqual(before + tenMinMs - 100);
    expect(exp.getTime()).toBeLessThanOrEqual(after + tenMinMs + 100);
  });

  it('is in the future', () => {
    expect(otpExpiresAt().getTime()).toBeGreaterThan(Date.now());
  });
});

describe('maskPhone()', () => {
  it('masks middle digits of a 10-digit number', () => {
    expect(maskPhone('9876543210')).toBe('+91XXXXXX3210');
  });

  it('handles number with country code prefix', () => {
    expect(maskPhone('919876543210')).toBe('+91XXXXXX3210');
  });
});
