'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getToken(): Promise<string> {
  const store = await cookies();
  return store.get('better-auth.session_token')?.value ?? '';
}

/**
 * Record the user's explicit consent to be referred to a lender from the budget
 * page. `consent` is always sent literal-true from an un-pre-ticked checkbox;
 * the API rejects any other value (RBI Digital Lending Directions 2025).
 *
 * Context is always 'PLANNING' for wedding budget shortfall referrals.
 */
export async function recordBudgetLendingConsentAction(input: {
  weddingId: string;
  offerRef: string;
}): Promise<{ success: boolean; referralId?: string; error?: string }> {
  const token = await getToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/lending/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `better-auth.session_token=${token}` },
      body: JSON.stringify({
        offerRef: input.offerRef,
        context: 'PLANNING',
        contextId: input.weddingId,
        consent: true,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { success: false, error: body.error?.message ?? `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { data?: { referral?: { id?: string } } };
    return { success: true, referralId: json.data?.referral?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
