'use server';

/**
 * Service enquiry Server Action — Phase 8, Unit 8.2.
 * Mutation via Server Action, not a Next API route (CLAUDE.md rule 3).
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface ServiceEnquiryResult {
  success: boolean;
  enquiryId?: string;
  code?: string;
  error?: string;
}

export async function createServiceEnquiryAction(input: {
  serviceId: string;
  message: string;
  preferredContact?: 'EMAIL' | 'PHONE' | 'WHATSAPP';
  city?: string;
}): Promise<ServiceEnquiryResult> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  if (!token) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Please sign in to send an enquiry.' };
  }

  try {
    const body: Record<string, unknown> = { message: input.message };
    if (input.preferredContact) body['preferredContact'] = input.preferredContact;
    if (input.city) body['city'] = input.city;

    const res = await fetch(
      `${API_BASE}/api/v1/post-marriage/services/${input.serviceId}/enquiries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `better-auth.session_token=${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    const json = (await res.json()) as {
      data?: { id?: string };
      error?: { code?: string; message?: string };
    };

    if (!res.ok) {
      return {
        success: false,
        code:  json.error?.code ?? `HTTP_${res.status}`,
        error: json.error?.message ?? `Request failed (${res.status})`,
      };
    }

    revalidatePath('/services/post-marriage');
    return { success: true, ...(json.data?.id ? { enquiryId: json.data.id } : {}) };
  } catch (e) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}
