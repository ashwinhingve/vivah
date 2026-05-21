'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

export async function subscribeToPlanAction(
  planCode: string,
): Promise<{ ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/payments/subscriptions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body:    JSON.stringify({ planCode }),
      cache:   'no-store',
    });
  } catch {
    return { ok: false, error: 'Network error — please try again' };
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string; error?: { message?: string } };
    const msg = json.error?.message ?? json.message ?? `Server error ${res.status}`;
    return { ok: false, error: msg };
  }

  const json = await res.json().catch(() => ({})) as { data?: { shortUrl: string | null } };
  const shortUrl = json.data?.shortUrl ?? null;

  if (shortUrl) redirect(shortUrl);
  redirect('/dashboard?subscribed=1');
}
