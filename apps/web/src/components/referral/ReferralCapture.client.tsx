'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Captures a referral code from a share link (`/?ref=CODE`) into a short-lived
 * cookie so it survives the hop from landing page → register → OTP verify.
 *
 * The cookie is deliberately NOT httpOnly: the register form reads it back to
 * prefill the manual field, and it carries no authority — the API validates the
 * code and ignores anything unknown. It is scoped to one hour because a referral
 * attribution that outlives the visit is more likely to mis-credit a later,
 * unrelated signup than to reward the actual referrer.
 *
 * Mounted high in the tree so it catches the code wherever the link lands.
 */
export const REFERRAL_COOKIE = 'referral_code';

/** Read the captured referral code, if any. Safe to call during SSR (returns null). */
export function readReferralCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)referral_code=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get('ref');
    if (!raw) return;

    // Codes are 8 chars from a fixed alphabet (see referralService CODE_ALPHABET).
    // Reject anything else rather than round-tripping arbitrary input into a cookie.
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return;

    document.cookie = [
      `${REFERRAL_COOKIE}=${encodeURIComponent(code)}`,
      'path=/',
      'max-age=3600',
      'samesite=lax',
    ].join('; ');
  }, [searchParams]);

  return null;
}
