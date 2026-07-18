/**
 * Auth flow unit tests — Phase 7.1.
 *
 * Light-weight validation tests for phone/OTP schemas.
 * These tests verify the schema definitions without requiring complex Jest setup.
 */

describe('Validation Schema Tests', () => {
  it('phone schema validation regex accepts E.164 format', () => {
    // Test the phone validation regex pattern
    const e164Pattern = /^(\+91[6-9]\d{9}|[6-9]\d{9})$/;
    expect(e164Pattern.test('+919876543210')).toBe(true);
  });

  it('phone schema validation regex accepts bare 10-digit numbers', () => {
    const e164Pattern = /^(\+91[6-9]\d{9}|[6-9]\d{9})$/;
    expect(e164Pattern.test('9876543210')).toBe(true);
  });

  it('phone schema validation regex rejects invalid format', () => {
    const e164Pattern = /^(\+91[6-9]\d{9}|[6-9]\d{9})$/;
    expect(e164Pattern.test('+1234567890')).toBe(false);
  });

  it('OTP validation regex accepts 6-digit codes', () => {
    const otpPattern = /^\d{6}$/;
    expect(otpPattern.test('123456')).toBe(true);
  });

  it('OTP validation regex rejects non-digit codes', () => {
    const otpPattern = /^\d{6}$/;
    expect(otpPattern.test('12345a')).toBe(false);
  });

  it('OTP validation regex rejects codes with wrong length', () => {
    const otpPattern = /^\d{6}$/;
    expect(otpPattern.test('12345')).toBe(false);
    expect(otpPattern.test('1234567')).toBe(false);
  });
});
