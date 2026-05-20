'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export type AllowMessageFrom = 'EVERYONE' | 'VERIFIED_ONLY' | 'SAME_COMMUNITY' | 'ACCEPTED_ONLY';
export type PrivacyPreset   = 'CONSERVATIVE' | 'BALANCED' | 'OPEN';

export interface SafetyMode {
  contactHidden?:        boolean;
  photoHidden?:          boolean;
  incognito?:            boolean;
  showLastActive?:       boolean;
  showReadReceipts?:     boolean;
  photoBlurUntilUnlock?: boolean;
  hideFromSearch?:       boolean;
  allowMessageFrom?:     AllowMessageFrom;
}

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

export async function updatePrivacyTogglesAction(
  next: SafetyMode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/profiles/me/safety-mode`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body:    JSON.stringify(next),
      cache:   'no-store',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? 'Could not save settings' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — please try again' };
  }
}

export async function applyPrivacyPresetAction(
  preset: PrivacyPreset,
): Promise<{ ok: true; safetyMode: SafetyMode } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/profiles/me/safety-mode/preset`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body:    JSON.stringify({ preset }),
      cache:   'no-store',
    });
    if (!res.ok) return { ok: false, error: 'preset failed' };
    const body = (await res.json()) as { success: boolean; data: { safetyMode: SafetyMode } };
    return { ok: true, safetyMode: body.data.safetyMode };
  } catch {
    return { ok: false, error: 'Could not apply preset' };
  }
}
