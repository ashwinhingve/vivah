'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

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
  const type      = trim(formData.get('type'));
  const date      = trim(formData.get('date'));
  const venue     = trim(formData.get('venue'));
  const startTime = trim(formData.get('startTime'));
  const endTime   = trim(formData.get('endTime'));
  const notes     = trim(formData.get('notes'));
  if (type)      payload['type']      = type;
  if (date)      payload['date']      = date;
  if (venue)     payload['venue']     = venue;
  if (startTime) payload['startTime'] = startTime;
  if (endTime)   payload['endTime']   = endTime;
  if (notes)     payload['notes']     = notes;

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
  const date      = trim(formData.get('date'));
  const venue     = trim(formData.get('venue'));
  const startTime = trim(formData.get('startTime'));
  const endTime   = trim(formData.get('endTime'));
  const notes     = trim(formData.get('notes'));
  if (date)      payload['date']      = date;
  if (venue)     payload['venue']     = venue;
  if (startTime) payload['startTime'] = startTime;
  if (endTime)   payload['endTime']   = endTime;
  if (notes)     payload['notes']     = notes;

  await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/ceremonies/${ceremonyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  revalidatePath(`/weddings/${weddingId}`);
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
