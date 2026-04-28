/**
 * Smart Shaadi — OTP brute-force lockout
 * apps/api/src/auth/otpLockout.ts
 *
 * Two complementary defenses:
 *
 *  1. Per-phone "wrong code" counter — incremented when a verify-otp call
 *     returns OTP_INVALID. Five wrong codes inside the 15-minute window
 *     locks the phone for 15 minutes (no new OTP sends, no verifies).
 *
 *  2. Per-phone "OTP send" counter — soft signal we use to log OTP_SENT
 *     events; rate-limit on send is enforced by Better Auth's built-in
 *     `rateLimit.max` setting (3 sends per 10-minute window).
 *
 * Redis is the single source of truth so multiple API replicas share state.
 * Falls back to "no lockout" if Redis is unreachable — auth must remain
 * available even if the lockout cache is down. Failures emit a warning.
 */

import { redis } from '../lib/redis.js';

const FAIL_KEY = (phone: string) => `auth:otp:fail:${phone}`;
const LOCK_KEY = (phone: string) => `auth:otp:lock:${phone}`;
const SEND_KEY = (phone: string) => `auth:otp:send:${phone}`;

const FAIL_WINDOW_S = 15 * 60;   // count failures over 15 min
const FAIL_THRESHOLD = 5;         // 5 wrong codes triggers lockout
const LOCK_DURATION_S = 15 * 60; // lockout lasts 15 min

/** Returns true when the phone is currently locked. */
export async function isPhoneLocked(phone: string): Promise<boolean> {
  try {
    const v = await redis.get(LOCK_KEY(phone));
    return v !== null;
  } catch (error) {
    console.warn('[otp-lockout] redis get failed', error);
    return false;
  }
}

/** Records an OTP send (informational counter; primary rate-limit lives in Better Auth). */
export async function recordOtpSent(phone: string): Promise<void> {
  try {
    await redis.incr(SEND_KEY(phone));
    await redis.expire(SEND_KEY(phone), FAIL_WINDOW_S);
  } catch (error) {
    console.warn('[otp-lockout] recordOtpSent failed', error);
  }
}

/**
 * Increments the failed-attempt counter for a phone and applies the lockout
 * if the threshold is reached. Returns the resulting state so the caller can
 * surface a useful error (`remaining` until threshold).
 */
export async function recordOtpFailure(phone: string): Promise<{
  failures: number;
  locked: boolean;
  remaining: number;
}> {
  try {
    const failures = await redis.incr(FAIL_KEY(phone));
    if (failures === 1) {
      await redis.expire(FAIL_KEY(phone), FAIL_WINDOW_S);
    }
    if (failures >= FAIL_THRESHOLD) {
      await redis.set(LOCK_KEY(phone), '1', 'EX', LOCK_DURATION_S);
      // Reset failure counter so the next 15-minute window starts clean once
      // the lock expires.
      await redis.del(FAIL_KEY(phone));
      return { failures, locked: true, remaining: 0 };
    }
    return { failures, locked: false, remaining: FAIL_THRESHOLD - failures };
  } catch (error) {
    console.warn('[otp-lockout] recordOtpFailure failed', error);
    return { failures: 0, locked: false, remaining: FAIL_THRESHOLD };
  }
}

/** Clear failure + lockout state on a successful verification. */
export async function recordOtpSuccess(phone: string): Promise<void> {
  try {
    await redis.del(FAIL_KEY(phone), LOCK_KEY(phone));
  } catch (error) {
    console.warn('[otp-lockout] recordOtpSuccess failed', error);
  }
}
