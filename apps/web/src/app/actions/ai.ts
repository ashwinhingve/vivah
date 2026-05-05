'use server';

import { cookies } from 'next/headers';
import type { CoachResponse } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const FALLBACK: CoachResponse = {
  suggestions: [],
  state: 'STARTING',
  cached: false,
  fallback: true,
};

export async function fetchCoachSuggestions(matchId: string): Promise<CoachResponse> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/ai/coach/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `better-auth.session_token=${token}`,
      },
      body: JSON.stringify({ matchId }),
      cache: 'no-store',
    });
    if (!res.ok) return FALLBACK;
    const json = (await res.json()) as { success?: boolean; data?: CoachResponse };
    return json.data ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}
