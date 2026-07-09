'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

type Result = { ok: true } | { ok: false; error: string };

async function patch(path: string, body: unknown): Promise<Result> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j.error?.message ?? 'Request failed' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — please try again' };
  }
}

export async function setUserStatusAction(
  userId: string,
  status: 'SUSPENDED' | 'ACTIVE',
  reason?: string,
): Promise<Result> {
  const r = await patch(`/api/v1/admin/users/${userId}/status`, reason ? { status, reason } : { status });
  if (r.ok) {
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath('/admin/users');
  }
  return r;
}

export async function bulkSetUserStatusAction(
  userIds: string[],
  status: 'SUSPENDED' | 'ACTIVE',
  reason?: string,
): Promise<{ ok: boolean; succeeded: number; failed: number; error?: string }> {
  const ids = Array.from(new Set(userIds)).slice(0, 100);
  if (ids.length === 0) return { ok: false, succeeded: 0, failed: 0, error: 'No users selected.' };

  const results = await Promise.all(
    ids.map((id) => patch(`/api/v1/admin/users/${id}/status`, reason ? { status, reason } : { status })),
  );
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  revalidatePath('/admin/users');
  return { ok: failed === 0, succeeded, failed };
}
