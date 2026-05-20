'use server';

/**
 * Divorcee/Widow onboarding Server Actions.
 *
 * CLAUDE.md rule 3: Server Actions for all mutations.
 * CLAUDE.md rule 12: userId is resolved to profileId inside the API
 *   (the /api/v1 endpoints handle that mapping).
 */

import { cookies } from 'next/headers';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Mark the divorcee/widow onboarding journey as completed for the current
 * user, and optionally persist a private contextual note to their profile
 * content in MongoDB.
 *
 * The note is stored under `partnerPreferences.divorceeNote` and is NEVER
 * exposed to other users — it is for platform personalisation only.
 */
export async function markDivorceeOnboardingDone(
  note?: string,
): Promise<ActionResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('better-auth.session_token')?.value ?? '';

    // 1. If a note was provided, persist it in preferences (private field)
    if (note) {
      const prefRes = await fetch(`${API_URL}/api/v1/profiles/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `better-auth.session_token=${token}`,
        },
        body: JSON.stringify({ divorceeNote: note }),
      });
      if (!prefRes.ok) {
        // Non-blocking — note save failure should not block onboarding completion
        console.warn('[divorcee-onboarding] note save failed:', prefRes.status);
      }
    }

    // 2. Mark the one-time flag so this page is not shown again
    const flagRes = await fetch(`${API_URL}/api/v1/profiles/me/sections/divorcee-onboarding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      body: JSON.stringify({ done: true }),
    });

    if (!flagRes.ok) {
      const text = await flagRes.text();
      let msg = `HTTP ${flagRes.status}`;
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
