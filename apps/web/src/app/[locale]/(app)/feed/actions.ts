'use server';

/**
 * Feed Server Actions — mutations that originate from the match feed.
 *
 * CLAUDE.md rule 3: Server Actions for all mutations.
 */

import { cookies } from 'next/headers';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type MaritalStatusValue = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Persist the user's preferred marital statuses to the API.
 * Calls PUT /api/v1/profiles/me/preferences with the `maritalStatus` array.
 */
export async function updateMaritalPreferences(
  maritalStatus: MaritalStatusValue[],
): Promise<ActionResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('better-auth.session_token')?.value ?? '';

    const res = await fetch(`${API_URL}/api/v1/profiles/me/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      body: JSON.stringify({ maritalStatus }),
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(text) as { error?: { message?: string } };
        msg = json.error?.message ?? msg;
      } catch { /* non-JSON */ }
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}
