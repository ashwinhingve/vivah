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

export async function createDestinationAction(
  weddingId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; destinationId?: string }> {
  const payload: Record<string, unknown> = {};
  const city = trim(formData.get('city'));
  const countryCode = trim(formData.get('countryCode'));
  const ianaTimezone = trim(formData.get('ianaTimezone'));
  const arriveOn = trim(formData.get('arriveOn'));
  const departOn = trim(formData.get('departOn'));
  const notes = trim(formData.get('notes'));

  // Only city and the date window are genuinely required — countryCode and
  // ianaTimezone have server-side defaults (IN / Asia/Kolkata), so demanding them
  // here would reject a perfectly valid domestic leg the API would accept.
  if (!city || !arriveOn || !departOn) {
    return { ok: false, error: 'City, arrival and departure dates are required.' };
  }

  payload['city'] = city;
  payload['arriveOn'] = arriveOn;
  payload['departOn'] = departOn;
  if (countryCode) payload['countryCode'] = countryCode;
  if (ianaTimezone) payload['ianaTimezone'] = ianaTimezone;
  if (notes) payload['notes'] = notes;
  if (formData.get('isPrimary') === 'on') payload['isPrimary'] = true;

  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/destinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    // The API wraps the new leg as data.destination — reading data.id here would
    // silently return undefined and break the post-create redirect.
    const json = (await res.json()) as {
      success: boolean;
      data?: { destination?: { id: string } };
      error?: unknown;
    };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not create destination.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations`);
    const newId = json.data?.destination?.id;
    return newId ? { ok: true, destinationId: newId } : { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function updateDestinationAction(
  weddingId: string,
  destinationId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const payload: Record<string, unknown> = {};
  const city = trim(formData.get('city'));
  const countryCode = trim(formData.get('countryCode'));
  const ianaTimezone = trim(formData.get('ianaTimezone'));
  const arriveOn = trim(formData.get('arriveOn'));
  const departOn = trim(formData.get('departOn'));
  const notes = trim(formData.get('notes'));

  if (city) payload['city'] = city;
  if (countryCode) payload['countryCode'] = countryCode;
  if (ianaTimezone) payload['ianaTimezone'] = ianaTimezone;
  if (arriveOn) payload['arriveOn'] = arriveOn;
  if (departOn) payload['departOn'] = departOn;
  if (notes !== undefined) payload['notes'] = notes ?? null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/destinations/${destinationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not update destination.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations`);
    revalidatePath(`/weddings/${weddingId}/destinations/${destinationId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function deleteDestinationAction(
  weddingId: string,
  destinationId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/destinations/${destinationId}`, {
      method: 'DELETE',
      headers: { Cookie: await cookieHeader() },
      cache: 'no-store',
    });

    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not delete destination.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function setPrimaryDestinationAction(
  weddingId: string,
  destinationId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/weddings/${weddingId}/destinations/${destinationId}/set-primary`,
      {
        method: 'POST',
        headers: { Cookie: await cookieHeader() },
        cache: 'no-store',
      },
    );

    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not set primary destination.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations`);
    revalidatePath(`/weddings/${weddingId}/destinations/${destinationId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function reorderDestinationsAction(
  weddingId: string,
  order: Array<{ id: string; sortOrder: number }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings/${weddingId}/destinations/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body: JSON.stringify({ order }),
      cache: 'no-store',
    });

    const json = (await res.json()) as { success: boolean; error?: unknown };
    if (!json.success) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : (json.error as { message?: string })?.message ?? 'Could not reorder destinations.';
      return { ok: false, error: msg };
    }

    revalidatePath(`/weddings/${weddingId}/destinations`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
