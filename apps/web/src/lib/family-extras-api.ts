/**
 * Family Mode API extras — additive helpers for endpoints that don't belong
 * in the shared `family-mode-api.ts` client. Same server/browser fetch
 * pattern (cookie-forwarding on the server, credentials:'include' in browser).
 */

import type { WeddingSummary } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
}

async function getJson<T>(path: string, cookie?: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...(cookie !== undefined
        ? { headers: { cookie } }
        : { credentials: 'include' as const }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<T>;
    return json.success ? (json.data ?? null) : null;
  } catch { return null; }
}

// ── Linked child's own profile id ──────────────────────────────────────────
// A parent needs this to open the family-compatibility view "as" the child —
// the child's own profile is the rating "subject", the candidate is who's
// being rated.

export async function getChildProfileId(
  childUserId: string,
  cookie?: string,
): Promise<string | null> {
  const data = await getJson<{ profileId: string | null }>(
    `/api/v1/family-mode/parent/children/${childUserId}/profile`,
    cookie,
  );
  return data?.profileId ?? null;
}

// ── Weddings you collaborate on (Pillar 2 of the family hub) ────────────────

export interface CollaboratingWedding extends WeddingSummary {
  myRole: 'EDITOR' | 'VIEWER';
}

export async function getCollaboratingWeddings(
  cookie?: string,
): Promise<CollaboratingWedding[]> {
  const data = await getJson<{ weddings: CollaboratingWedding[] }>(
    '/api/v1/weddings/collaborating',
    cookie,
  );
  return data?.weddings ?? [];
}
