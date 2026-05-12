/**
 * Client helpers for the Referral Programme API.
 *
 * Server-side fetches forward the `cookie` header from `next/headers`
 * (see settings/referral/page.tsx). Browser-side fetches use
 * `credentials: 'include'` to send the Better Auth cookie.
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface MyCode {
  code:       string;
  uses_count: number;
  is_active:  boolean;
  created_at: string;
  expires_at: string | null;
}

export interface ReferralActivityItem {
  id:                    string;
  status:                string;
  reward_credited:       boolean;
  reward_amount_credits: number;
  referred_name:         string | null;
  created_at:            string;
  converted_at:          string | null;
}

export interface MyActivity {
  code:          { code: string; uses_count: number; is_active: boolean; created_at: string } | null;
  total_credits: number;
  referrals:     ReferralActivityItem[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
}

async function getJson<T>(path: string, cookie?: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...(cookie !== undefined
        ? { headers: { cookie } }
        : { credentials: 'include' as const }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<T>;
    return json.data ?? null;
  } catch {
    return null;
  }
}

export function fetchMyCode(cookie?: string): Promise<MyCode | null> {
  return getJson<MyCode>('/api/v1/referral/my-code', cookie);
}

export function fetchMyActivity(cookie?: string): Promise<MyActivity | null> {
  return getJson<MyActivity>('/api/v1/referral/my-activity', cookie);
}

export interface ValidateResult {
  valid:           boolean;
  referrer_name?:  string | null;
}

export function validateReferralCode(code: string): Promise<ValidateResult | null> {
  return getJson<ValidateResult>(`/api/v1/referral/validate/${encodeURIComponent(code)}`);
}
