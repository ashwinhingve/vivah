'use server';

/**
 * Admin package management actions — Phase 8, Unit 8.1.
 *
 * The most important action here is `setPlaceholderAction`. Promoting seeded
 * fictional inventory to a real onboarded partner is exactly one field change,
 * and this is the operator's button for it: flipping the flag to false unlocks
 * the booking path for that package with no schema change and no re-keying.
 *
 * Every call goes through the API, which enforces ADMIN via authorize(['ADMIN']).
 * These actions do not re-check the role — duplicating an authorisation rule in
 * the web layer creates a second place for it to drift.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface AdminActionResult {
  success: boolean;
  error?: string;
  code?: string;
}

async function call(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<AdminActionResult> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  if (!token) return { success: false, code: 'UNAUTHORIZED', error: 'Not signed in.' };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      return {
        success: false,
        code: json.error?.code ?? `HTTP_${res.status}`,
        error: json.error?.message ?? `Request failed (${res.status})`,
      };
    }

    // Both the admin list and the public browse change when a package does.
    revalidatePath('/admin/packages');
    revalidatePath('/packages');
    return { success: true };
  } catch (e) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

/**
 * Promote seeded inventory to real supply, or mark supply as placeholder again.
 *
 * `false` is the onboarding action: it unlocks booking for this package. The
 * operator must have replaced the contact details and imagery first — the flag
 * says "this is a real business we can transact with", and nothing else checks
 * that claim.
 */
export async function setPlaceholderAction(
  id: string,
  isPlaceholder: boolean,
): Promise<AdminActionResult> {
  return call(`/api/v1/packages/admin/${id}`, 'PATCH', { isPlaceholder });
}

/** Show or hide a package in the public catalogue. */
export async function setActiveAction(
  id: string,
  isActive: boolean,
): Promise<AdminActionResult> {
  return call(`/api/v1/packages/admin/${id}`, 'PATCH', { isActive });
}

/** Soft delete — the API deactivates rather than dropping the row, so the
 *  package's captured enquiries survive it. */
export async function deactivatePackageAction(id: string): Promise<AdminActionResult> {
  return call(`/api/v1/packages/admin/${id}`, 'DELETE');
}

export async function createPackageAction(input: {
  vendorId: string;
  slug: string;
  title: string;
  tier: 'ESSENTIAL' | 'SIGNATURE' | 'LUXE';
  destinationCity: string;
  priceFrom: string;
  guestCapacityMin: number;
  guestCapacityMax: number;
  durationNights: number;
  summary?: string;
  description?: string;
  isPlaceholder: boolean;
}): Promise<AdminActionResult> {
  return call('/api/v1/packages/admin', 'POST', input);
}
