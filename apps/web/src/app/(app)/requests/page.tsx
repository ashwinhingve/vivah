import { cookies } from 'next/headers';
import type { EnrichedMatchRequest } from '@smartshaadi/types';
import { RequestsClient } from './RequestsClient.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchSide(side: 'received' | 'sent'): Promise<EnrichedMatchRequest[]> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(
      `${API_BASE}/api/v1/matchmaking/requests/enriched?side=${side}&limit=100`,
      {
        headers: { Cookie: `better-auth.session_token=${token}` },
        cache:   'no-store',
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data?: { requests?: EnrichedMatchRequest[] } };
    return json.data?.requests ?? [];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const [initialReceived, initialSent] = await Promise.all([
    fetchSide('received'),
    fetchSide('sent'),
  ]);

  return (
    <RequestsClient initialReceived={initialReceived} initialSent={initialSent} />
  );
}
