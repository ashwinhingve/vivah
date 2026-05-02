'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function token() {
  return (await cookies()).get('better-auth.session_token')?.value;
}

async function call(path: string, init: RequestInit = {}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const t = await token();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Cookie: `better-auth.session_token=${t}` } : {}),
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({})) as { success?: boolean; data?: unknown; error?: { message?: string } };
    if (json.success) return { ok: true, data: json.data };
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'Network error. Please retry.' };
  }
}

function bust() {
  revalidatePath('/profile/kyc');
  revalidatePath('/dashboard');
}

export async function submitPanAction(input: { pan: string; nameOnPan: string; dob: string }) {
  const r = await call('/api/v1/kyc/pan', { method: 'POST', body: JSON.stringify(input) });
  if (r.ok) bust();
  return r;
}

export async function submitBankAction(input: { accountNumber: string; ifsc: string; accountHolderName: string }) {
  const r = await call('/api/v1/kyc/bank', { method: 'POST', body: JSON.stringify(input) });
  if (r.ok) bust();
  return r;
}

export async function submitLivenessAction(input: { videoR2Key: string; selfieR2Key?: string; challengesPassed: string[] }) {
  const r = await call('/api/v1/kyc/liveness', { method: 'POST', body: JSON.stringify(input) });
  if (r.ok) bust();
  return r;
}

export async function submitFaceMatchAction(selfieR2Key: string) {
  const r = await call('/api/v1/kyc/face-match', { method: 'POST', body: JSON.stringify({ selfieR2Key }) });
  if (r.ok) bust();
  return r;
}

export async function uploadDocumentAction(input: { documentType: string; r2Key: string; documentLast4?: string; expiresAt?: string }) {
  const r = await call('/api/v1/kyc/document', { method: 'POST', body: JSON.stringify(input) });
  if (r.ok) bust();
  return r;
}

export async function fileAppealAction(input: { message: string; evidenceR2Keys: string[] }) {
  const r = await call('/api/v1/kyc/appeal', { method: 'POST', body: JSON.stringify(input) });
  if (r.ok) bust();
  return r;
}

export async function reverifyAction() {
  const r = await call('/api/v1/kyc/reverify', { method: 'POST', body: '{}' });
  if (r.ok) bust();
  return r;
}
