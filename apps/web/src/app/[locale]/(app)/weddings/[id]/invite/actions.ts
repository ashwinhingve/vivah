'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { InviteRecord } from '@/lib/invites/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

export interface InviteActionState {
  ok: boolean;
  error?: string;
  invite?: InviteRecord;
}

export async function saveInviteAction(
  weddingId: string,
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const payload = {
    templateId: String(formData.get('templateId') ?? 'classic-royal'),
    title: (formData.get('title') as string) || null,
    message: (formData.get('message') as string) || null,
    rsvpEnabled: formData.get('rsvpEnabled') === 'on' || formData.get('rsvpEnabled') === 'true',
  };

  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/invite`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? 'Failed to save invite' };
    revalidatePath(`/weddings/${weddingId}/invite`);
    return { ok: true, invite: json.data as InviteRecord };
  } catch {
    return { ok: false, error: 'Network error while saving invite' };
  }
}

export async function publishInviteAction(weddingId: string): Promise<InviteActionState> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/invite/publish`, {
      method: 'POST',
      headers: { Cookie: await cookieHeader() },
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? 'Failed to publish invite' };
    revalidatePath(`/weddings/${weddingId}/invite`);
    return { ok: true, invite: json.data as InviteRecord };
  } catch {
    return { ok: false, error: 'Network error while publishing invite' };
  }
}
