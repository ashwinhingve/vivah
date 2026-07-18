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

export async function upsertGuestTravelLegAction(
  weddingId: string,
  destinationId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; legId?: string }> {
  const payload: Record<string, unknown> = {};
  const guestId = trim(formData.get('guestId'));
  const arrivalDate = trim(formData.get('arrivalDate'));
  const arrivalTime = trim(formData.get('arrivalTime'));
  const departureDate = trim(formData.get('departureDate'));
  const departureTime = trim(formData.get('departureTime'));
  const travelNotes = trim(formData.get('travelNotes'));

  // Only the guest is required. Every date and time is optional by contract,
  // because a planner routinely knows someone is coming long before they know
  // the flight — demanding all four here would make the common case unsaveable.
  if (!guestId) {
    return { ok: false, error: 'Please choose a guest.' };
  }

  payload['guestId'] = guestId;
  if (arrivalDate) payload['arrivalDate'] = arrivalDate;
  if (arrivalTime) payload['arrivalTime'] = arrivalTime;
  if (departureDate) payload['departureDate'] = departureDate;
  if (departureTime) payload['departureTime'] = departureTime;
  if (travelNotes) payload['travelNotes'] = travelNotes;

  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/destinations/${destinationId}/travel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    // The API wraps the row as data.travel — reading data.id would be undefined.
    const json = (await res.json()) as {
      success: boolean;
      data?: { travel?: { id: string } };
      error?: unknown;
    };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not save travel leg.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations/${destinationId}`);
    const newLegId = json.data?.travel?.id;
    return newLegId ? { ok: true, legId: newLegId } : { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function deleteGuestTravelLegAction(
  weddingId: string,
  destinationId: string,
  legId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/weddings/${weddingId}/destinations/${destinationId}/travel/${legId}`,
      {
        method: 'DELETE',
        headers: { Cookie: await cookieHeader() },
        cache: 'no-store',
      },
    );

    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not delete travel leg.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations/${destinationId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
