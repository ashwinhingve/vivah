'use server';

/**
 * Package enquiry Server Action — Phase 8, Unit 8.1.
 *
 * Mutation via Server Action, not a Next API route (CLAUDE.md rule 3). The
 * action forwards to the API, which is the single enforcement point for both
 * validation and the placeholder rule.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface EnquiryResult {
  success: boolean;
  enquiryId?: string;
  /** Machine-readable so the client can branch without matching on prose. */
  code?: string;
  error?: string;
}

async function getToken(): Promise<string> {
  const store = await cookies();
  return store.get('better-auth.session_token')?.value ?? '';
}

export async function createPackageEnquiryAction(input: {
  packageId: string;
  message: string;
  eventDate?: string;
  guestCount?: number;
}): Promise<EnquiryResult> {
  const token = await getToken();
  if (!token) return { success: false, code: 'UNAUTHORIZED', error: 'Please sign in to send an enquiry.' };

  try {
    const body: Record<string, unknown> = { message: input.message };
    // Only send optional fields when actually provided — posting an empty
    // string would fail the API's date validation rather than being ignored.
    if (input.eventDate) body['eventDate'] = input.eventDate;
    if (input.guestCount && input.guestCount > 0) body['guestCount'] = input.guestCount;

    const res = await fetch(`${API_BASE}/api/v1/packages/${input.packageId}/enquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      data?: { id?: string };
      error?: { code?: string; message?: string };
    };

    if (!res.ok) {
      return {
        success: false,
        code:  json.error?.code ?? 'HTTP_' + res.status,
        error: json.error?.message ?? `Request failed (${res.status})`,
      };
    }

    // Refresh the "my enquiries" list so a second visit shows the new row.
    revalidatePath('/packages');
    return { success: true, ...(json.data?.id ? { enquiryId: json.data.id } : {}) };
  } catch (e) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}
