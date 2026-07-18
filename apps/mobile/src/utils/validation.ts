import { z } from 'zod';
import { PhoneSchema } from '@smartshaadi/schemas';

/**
 * Phone validation — reuses the canonical `PhoneSchema` shared with the api and
 * web (accepts a bare 10-digit Indian number or E.164 `+91XXXXXXXXXX`). Importing
 * it here is also the runtime proof that the mobile app resolves the
 * `@smartshaadi/*` workspace packages through Metro's monorepo wiring.
 */
export const phoneSchema = PhoneSchema;

/** OTP validation — exactly 6 digits. */
export const otpSchema = z
  .string()
  .trim()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/);

/** Phone login request. */
export const phoneLoginSchema = z.object({
  phone: phoneSchema,
});

/** OTP verification request. */
export const otpVerificationSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});

export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
