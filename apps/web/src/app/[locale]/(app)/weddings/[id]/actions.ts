'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

function trim(val: FormDataEntryValue | null): string | undefined {
  if (typeof val !== 'string') return undefined;
  const s = val.trim();
  return s.length > 0 ? s : undefined;
}

export async function createCeremonyAction(weddingId: string, formData: FormData): Promise<void> {
  const payload: Record<string, string> = {};
  const type           = trim(formData.get('type'));
  const customTypeName = trim(formData.get('customTypeName'));
  const date           = trim(formData.get('date'));
  const venue          = trim(formData.get('venue'));
  const startTime      = trim(formData.get('startTime'));
  const notes          = trim(formData.get('notes'));
  if (type)                            payload['type']           = type;
  if (type === 'OTHER' && customTypeName) payload['customTypeName'] = customTypeName;
  if (date)                            payload['date']           = date;
  if (venue)                           payload['venue']          = venue;
  if (startTime)                       payload['startTime']      = startTime;
  if (notes)                           payload['notes']          = notes;

  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/ceremonies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  revalidatePath(`/weddings/${weddingId}`);
}

export async function deleteCeremonyAction(weddingId: string, ceremonyId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/ceremonies/${ceremonyId}`, {
    method: 'DELETE',
    headers: { Cookie: await cookieHeader() },
    cache: 'no-store',
  });
  revalidatePath(`/weddings/${weddingId}`);
}

export async function updateCeremonyAction(
  weddingId: string,
  ceremonyId: string,
  formData: FormData,
): Promise<void> {
  const payload: Record<string, string> = {};
  const date           = trim(formData.get('date'));
  const venue          = trim(formData.get('venue'));
  const startTime      = trim(formData.get('startTime'));
  const customTypeName = trim(formData.get('customTypeName'));
  const notes          = trim(formData.get('notes'));
  if (date)           payload['date']           = date;
  if (venue)          payload['venue']          = venue;
  if (startTime)      payload['startTime']      = startTime;
  if (customTypeName) payload['customTypeName'] = customTypeName;
  if (notes)          payload['notes']          = notes;

  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/ceremonies/${ceremonyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  revalidatePath(`/weddings/${weddingId}`);
}

export type WeddingActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success' };

export async function updateWeddingAction(
  weddingId: string,
  _prev: WeddingActionState,
  formData: FormData,
): Promise<WeddingActionState> {
  const body: Record<string, unknown> = {};
  const weddingName  = trim(formData.get('weddingName'));
  const weddingDate  = trim(formData.get('weddingDate'));
  const venueName    = trim(formData.get('venueName'));
  const venueCity    = trim(formData.get('venueCity'));
  const venueAddress = trim(formData.get('venueAddress'));
  const budgetTotal  = trim(formData.get('budgetTotal'));

  if (weddingName  !== undefined) body['weddingName']  = weddingName ?? '';
  if (weddingDate)                body['weddingDate']  = weddingDate;
  if (venueName    !== undefined) body['venueName']    = venueName ?? '';
  if (venueCity    !== undefined) body['venueCity']    = venueCity ?? '';
  if (venueAddress !== undefined) body['venueAddress'] = venueAddress ?? '';
  if (budgetTotal && !Number.isNaN(parseFloat(budgetTotal))) {
    body['budgetTotal'] = parseFloat(budgetTotal);
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not update wedding.';
      return { status: 'error', message: msg };
    }
  } catch {
    return { status: 'error', message: 'Network error. Please try again.' };
  }

  revalidatePath(`/weddings/${weddingId}`);
  return { status: 'success' };
}

export async function cancelWeddingAction(weddingId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/cancel`, {
    method: 'PATCH',
    headers: { Cookie: await cookieHeader() },
    cache: 'no-store',
  });
  revalidatePath(`/weddings/${weddingId}`);
  revalidatePath('/weddings');
}

export async function deleteWeddingAction(weddingId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}`, {
    method: 'DELETE',
    headers: { Cookie: await cookieHeader() },
    cache: 'no-store',
  });
  revalidatePath('/weddings');
  redirect('/weddings');
}

export async function updateBudgetAction(
  weddingId: string,
  categories: Array<{ name: string; allocated: number; spent: number }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify({ categories }),
      cache: 'no-store',
    });
    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not save budget.';
      return { ok: false, error: msg };
    }
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
  revalidatePath(`/weddings/${weddingId}/budget`);
  revalidatePath(`/weddings/${weddingId}`);
  return { ok: true };
}

export async function selectMuhuratAction(weddingId: string, formData: FormData): Promise<void> {
  const date    = trim(formData.get('date'));
  const muhurat = trim(formData.get('muhurat'));
  const tithi   = trim(formData.get('tithi'));
  if (!date || !muhurat) return;

  const payload: Record<string, string> = { date, muhurat };
  if (tithi) payload['tithi'] = tithi;

  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/muhurat`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  revalidatePath(`/weddings/${weddingId}`);
}
