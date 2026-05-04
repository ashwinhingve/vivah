'use server';

import { cookies } from 'next/headers';
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

export type CreateWeddingState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

interface CreateWeddingResponse {
  success: boolean;
  data?:   { id: string };
  error?:  string;
}

export async function createWeddingAction(
  _prev: CreateWeddingState,
  formData: FormData,
): Promise<CreateWeddingState> {
  const body: Record<string, unknown> = {};
  const weddingDate = trim(formData.get('weddingDate'));
  const venueName   = trim(formData.get('venueName'));
  const venueCity   = trim(formData.get('venueCity'));
  const budgetTotal = trim(formData.get('budgetTotal'));

  if (weddingDate) body['weddingDate'] = weddingDate;
  if (venueName)   body['venueName']   = venueName;
  if (venueCity)   body['venueCity']   = venueCity;
  if (budgetTotal && !Number.isNaN(parseFloat(budgetTotal))) {
    body['budgetTotal'] = parseFloat(budgetTotal);
  }

  let json: CreateWeddingResponse;
  try {
    const res = await fetch(`${API_BASE}/api/v1/weddings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      body:    JSON.stringify(body),
      cache:   'no-store',
    });
    json = (await res.json()) as CreateWeddingResponse;
  } catch {
    return { status: 'error', message: 'Network error. Please check your connection and try again.' };
  }

  if (!json.success || !json.data?.id) {
    return { status: 'error', message: json.error ?? 'Could not create wedding. Please try again.' };
  }

  redirect(`/weddings/${json.data.id}`);
}
