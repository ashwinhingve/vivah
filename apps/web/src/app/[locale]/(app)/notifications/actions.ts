'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

/**
 * Thin Server Action wrappers over the notification REST endpoints. The client
 * provider updates its state optimistically and calls these to persist; a
 * `{ ok: false }` result tells it to roll back.
 */
async function call(path: string, method: 'POST' | 'DELETE'): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/users/me/notifications${path}`, {
      method,
      headers: { Cookie: await cookieHeader() },
      cache: 'no-store',
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function markReadAction(id: string): Promise<{ ok: boolean }> {
  return call(`/${encodeURIComponent(id)}/read`, 'POST');
}

export async function markUnreadAction(id: string): Promise<{ ok: boolean }> {
  return call(`/${encodeURIComponent(id)}/unread`, 'POST');
}

export async function markAllReadAction(): Promise<{ ok: boolean }> {
  return call('/read-all', 'POST');
}

export async function removeAction(id: string): Promise<{ ok: boolean }> {
  return call(`/${encodeURIComponent(id)}`, 'DELETE');
}

export async function clearAllAction(): Promise<{ ok: boolean }> {
  return call('', 'DELETE');
}
