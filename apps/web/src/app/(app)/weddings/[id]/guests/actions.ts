'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';
import { fetchAuth } from '@/lib/server-fetch';
import type { GuestRich, RsvpAnalytics } from '@smartshaadi/types';

interface ActionResult<T = unknown> {
  ok:    boolean;
  data?: T;
  error?: string;
}

export async function addGuestAction(
  weddingId: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<GuestRich>> {
  const r = await mutateApi<GuestRich>(`/api/v1/weddings/${weddingId}/guests`, {
    method: 'POST',
    body: payload,
  });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/guests`);
  return r;
}

export async function updateGuestAction(
  weddingId: string,
  guestId: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<GuestRich>> {
  const r = await mutateApi<GuestRich>(`/api/v1/weddings/${weddingId}/guests/${guestId}`, {
    method: 'PUT',
    body: payload,
  });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/guests`);
  return r;
}

export async function deleteGuestAction(
  weddingId: string,
  guestId: string,
): Promise<ActionResult> {
  const r = await mutateApi(`/api/v1/weddings/${weddingId}/guests/${guestId}`, {
    method: 'DELETE',
  });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/guests`);
  return r;
}

export async function checkInGuestAction(
  weddingId: string,
  guestId: string,
  checkedIn = true,
): Promise<ActionResult<GuestRich>> {
  const r = await mutateApi<GuestRich>(`/api/v1/weddings/${weddingId}/guests/${guestId}/check-in`, {
    method: 'POST',
    body: { checkedIn },
  });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/guests/check-in`);
  return r;
}

export async function importGuestsCsvAction(
  weddingId: string,
  csv: string,
): Promise<ActionResult<{ imported: number; invalid: Array<{ rowIndex: number; error: string }> }>> {
  const r = await mutateApi<{ imported: number; invalid: Array<{ rowIndex: number; error: string }> }>(
    `/api/v1/weddings/${weddingId}/guests/import-csv`,
    { method: 'POST', body: { csv } },
  );
  if (r.ok) revalidatePath(`/weddings/${weddingId}/guests`);
  return r;
}

export async function fetchGuestsRichAction(weddingId: string): Promise<GuestRich[]> {
  const r = await fetchAuth<{ guests: GuestRich[] }>(`/api/v1/weddings/${weddingId}/guests`);
  return r?.guests ?? [];
}

export async function fetchAnalyticsAction(weddingId: string): Promise<RsvpAnalytics | null> {
  return fetchAuth<RsvpAnalytics>(`/api/v1/weddings/${weddingId}/guests/analytics`);
}

export async function upsertAddressAction(
  weddingId: string,
  guestId: string,
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  return mutateApi(`/api/v1/weddings/${weddingId}/guests/${guestId}/address`, {
    method: 'PUT',
    body: payload,
  });
}

export async function upsertCeremonyPrefsAction(
  weddingId: string,
  guestId: string,
  prefs: Array<{ ceremonyId: string; attending: boolean; mealPref?: string }>,
): Promise<ActionResult> {
  return mutateApi(`/api/v1/weddings/${weddingId}/guests/${guestId}/ceremony-prefs`, {
    method: 'PUT',
    body: { prefs },
  });
}

export async function upsertDeadlineAction(
  weddingId: string,
  payload: { deadline: string; enforced?: boolean; reminderDays?: number[] },
): Promise<ActionResult> {
  const r = await mutateApi(`/api/v1/weddings/${weddingId}/rsvp-deadline`, {
    method: 'PUT',
    body: payload,
  });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/guests/analytics`);
  return r;
}
