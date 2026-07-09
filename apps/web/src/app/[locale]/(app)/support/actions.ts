'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { TicketPriority, TicketStatus } from '@/lib/support-api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

type Result = { ok: true } | { ok: false; error: string };

async function post(path: string, body: unknown, method: 'POST' | 'PATCH' = 'POST'): Promise<Result> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
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

export async function patchTicketAction(
  id: string,
  patch: { status?: TicketStatus; priority?: TicketPriority; assignedToUserId?: string | null },
): Promise<Result> {
  const r = await post(`/api/v1/support/tickets/${id}`, patch, 'PATCH');
  if (r.ok) { revalidatePath(`/support/tickets/${id}`); revalidatePath('/support'); }
  return r;
}

export async function assignToMeAction(id: string, myUserId: string): Promise<Result> {
  return patchTicketAction(id, { assignedToUserId: myUserId });
}

export async function resolveTicketAction(id: string): Promise<Result> {
  const r = await post(`/api/v1/support/tickets/${id}/resolve`, {});
  if (r.ok) { revalidatePath(`/support/tickets/${id}`); revalidatePath('/support'); }
  return r;
}

export async function addTicketMessageAction(
  id: string,
  body: string,
  isInternalNote: boolean,
): Promise<Result> {
  const r = await post(`/api/v1/support/tickets/${id}/messages`, { body, isInternalNote });
  if (r.ok) revalidatePath(`/support/tickets/${id}`);
  return r;
}

export async function actOnReportAction(
  reportId: string,
  action: 'DISMISS' | 'ESCALATE',
): Promise<Result> {
  const r = await post(`/api/v1/support/reports/${reportId}/action`, { action });
  if (r.ok) { revalidatePath('/support/reports'); revalidatePath('/support'); }
  return r;
}

export async function createTicketAction(input: {
  subject: string;
  description?: string;
  category?: string;
}): Promise<Result> {
  const r = await post('/api/v1/support/tickets', input);
  if (r.ok) revalidatePath('/support');
  return r;
}
