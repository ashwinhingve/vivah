'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface NotificationPrefs {
  push:       boolean;
  sms:        boolean;
  email:      boolean;
  inApp:      boolean;
  marketing:  boolean;
  mutedTypes: string[];
}

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

export async function updateNotificationPrefsAction(
  prefs: NotificationPrefs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/users/me/notification-preferences`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body:    JSON.stringify(prefs),
      cache:   'no-store',
    });
    if (!res.ok) return { ok: false, error: `Server returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
