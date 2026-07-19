/**
 * Validation schema tests — exercise the real zod schemas from
 * src/utils/validation.ts instead of duplicating their regexes.
 */
import { phoneSchema, otpSchema } from '../src/utils/validation';

describe('phoneSchema', () => {
  it('accepts E.164 format', () => {
    expect(phoneSchema.safeParse('+919876543210').success).toBe(true);
  });

  it('accepts bare 10-digit Indian numbers', () => {
    expect(phoneSchema.safeParse('9876543210').success).toBe(true);
  });

  it('rejects non-Indian country codes', () => {
    expect(phoneSchema.safeParse('+1234567890').success).toBe(false);
  });

  it('rejects numbers starting below 6', () => {
    expect(phoneSchema.safeParse('1234567890').success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts 6-digit codes', () => {
    expect(otpSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects non-digit codes', () => {
    expect(otpSchema.safeParse('12345a').success).toBe(false);
  });

  it('rejects codes with wrong length', () => {
    expect(otpSchema.safeParse('12345').success).toBe(false);
    expect(otpSchema.safeParse('1234567').success).toBe(false);
  });
});
