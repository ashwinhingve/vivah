'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getToken(): Promise<string> {
  const store = await cookies();
  return store.get('better-auth.session_token')?.value ?? '';
}

export async function createContractAction(input: {
  templateId: string;
  title: string;
  data: {
    party1: { name: string; email?: string; phone?: string; address?: string; gstinOrPan?: string };
    party2: { name: string; email?: string; phone?: string; address?: string; gstinOrPan?: string };
    effectiveDate: string;
    expiryDate?: string;
    amount?: number;
    terms?: string[];
    services?: string[];
    specialTerms?: Record<string, string>;
  };
}): Promise<{ success: boolean; contractId?: string; error?: string }> {
  const token = await getToken();

  try {
    const res = await fetch(`${API_BASE}/api/v1/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: { message?: string } };
      return { success: false, error: body.error?.message ?? `HTTP ${res.status}` };
    }

    const json = (await res.json()) as { data?: { contract?: { id?: string } } };
    return { success: true, contractId: json.data?.contract?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function sendForSignatureAction(
  contractId: string,
  provider: 'DIGILOCKER' | 'SIGNZY',
): Promise<{ success: boolean; signingUrl?: string; error?: string }> {
  const token = await getToken();

  try {
    const res = await fetch(`${API_BASE}/api/v1/documents/${contractId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      body: JSON.stringify({ provider }),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: { message?: string } };
      return { success: false, error: body.error?.message ?? `HTTP ${res.status}` };
    }

    const json = (await res.json()) as { data?: { signingUrl?: string } };
    return { success: true, signingUrl: json.data?.signingUrl };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function completeSignatureAction(
  contractId: string,
): Promise<{ success: boolean; error?: string }> {
  const token = await getToken();

  try {
    const res = await fetch(`${API_BASE}/api/v1/documents/${contractId}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.json() as { error?: { message?: string } };
      return { success: false, error: body.error?.message ?? `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function downloadPdfAction(contractId: string): Promise<void> {
  const token = await getToken();

  try {
    const res = await fetch(`${API_BASE}/api/v1/documents/${contractId}/pdf`, {
      method: 'GET',
      headers: {
        Cookie: `better-auth.session_token=${token}`,
      },
    });

    if (!res.ok) {
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contractId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    // silently fail
  }
}
