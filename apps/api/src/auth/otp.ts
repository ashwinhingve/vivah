import { createHash, randomInt, timingSafeEqual } from 'crypto';
import type { OtpPurpose } from '@vivah/types';
import { env } from '../lib/env.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_SECONDS = 60;

/** Generate a 6-digit OTP (100000–999999). */
export function generate6(): number {
  return randomInt(100_000, 1_000_000);
}

/** SHA-256(otp + phone + purpose). Deterministic for constant-time compare. */
export function hashOtp(otp: string, phone: string, purpose: OtpPurpose): string {
  return createHash('sha256').update(`${otp}:${phone}:${purpose}`).digest('hex');
}

/** Constant-time equality check between two hex hashes. */
export function verifyOtpHash(candidate: string, stored: string): boolean {
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(stored, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Returns the Date when the OTP expires (10 min from now). */
export function otpExpiresAt(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}

/** Mask a 10-digit Indian mobile number: 9876543210 → +91XXXXXX3210 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `+91XXXXXX${digits.slice(6)}`;
}

interface MSG91Response {
  type: string;
  message: string;
}

/** Send OTP via MSG91. Throws on network/API failure. */
export async function sendViaMSG91(phone: string, otp: number): Promise<void> {
  const body = JSON.stringify({
    template_id: env.MSG91_TEMPLATE_ID,
    mobile: `91${phone}`,
    otp: String(otp),
  });

  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: env.MSG91_API_KEY,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MSG91 error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as MSG91Response;
  if (data.type === 'error') {
    throw new Error(`MSG91 rejected OTP: ${data.message}`);
  }
}
