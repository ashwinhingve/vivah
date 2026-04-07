import { z } from 'zod';
import type { UserRole, OtpPurpose } from '@vivah/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Phone must be a 10-digit Indian mobile number');

const userRoleValues: [UserRole, ...UserRole[]] = [
  'INDIVIDUAL',
  'FAMILY_MEMBER',
  'VENDOR',
  'EVENT_COORDINATOR',
  'ADMIN',
  'SUPPORT',
];

const otpPurposeValues: [OtpPurpose, ...OtpPurpose[]] = [
  'LOGIN',
  'REGISTRATION',
  'KYC',
  'CONTACT_UNLOCK',
  'PASSWORD_RESET',
];

// ── Auth Schemas ──────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  phone: phoneSchema,
  role: z.enum(userRoleValues).optional().default('INDIVIDUAL'),
  name: z.string().trim().min(2).max(100).optional(),
});

export const LoginPhoneSchema = z.object({
  phone: phoneSchema,
});

export const VerifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().trim().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/),
  purpose: z.enum(otpPurposeValues),
});

// ── Inferred Types ────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginPhoneInput = z.infer<typeof LoginPhoneSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
