import { cookies } from 'next/headers';
import Link from 'next/link';
import { AcceptedMatchCard } from '@/components/matching/AcceptedMatchCard';
import type { MatchRequest, MatchRequestsResponse } from '@smartshaadi/types';

export const metadata = { title: 'Your Matches — Smart Shaadi' };

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchRequests(token: string, direction: 'received' | 'sent'): Promise<MatchRequest[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/requests/${direction}?limit=100`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw = await res.json() as unknown;
    if (
      typeof raw === 'object' && raw !== null &&
      'success' in raw && (raw as Record<string, unknown>)['success'] === true
    ) {
      const data = (raw as { success: true; data: MatchRequestsResponse }).data;
      return data.requests;
    }
    return [];
  } catch {
    return [];
  }
}

async function getAcceptedMatches(token: string): Promise<{ request: MatchRequest; perspective: 'received' | 'sent' }[]> {
  const [received, sent] = await Promise.all([
    fetchRequests(token, 'received'),
    fetchRequests(token, 'sent'),
  ]);

  const seen = new Set<string>();
  const accepted: { request: MatchRequest; perspective: 'received' | 'sent' }[] = [];

  for (const r of received) {
    if (r.status === 'ACCEPTED' && !seen.has(r.id)) {
      seen.add(r.id);
      accepted.push({ request: r, perspective: 'received' });
    }
  }
  for (const r of sent) {
    if (r.status === 'ACCEPTED' && !seen.has(r.id)) {
      seen.add(r.id);
      accepted.push({ request: r, perspective: 'sent' });
    }
  }

  return accepted.sort((a, b) =>
    new Date(b.request.updatedAt).getTime() - new Date(a.request.updatedAt).getTime(),
  );
}

export default async function MatchesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;

  const matches = token ? await getAcceptedMatches(token) : [];

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-screen-lg px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">Your Matches</h1>
            <p className="text-sm text-[#6B6B76] mt-0.5">
              {matches.length > 0
                ? `${matches.length} accepted match${matches.length !== 1 ? 'es' : ''}`
                : 'Accepted matches appear here'}
            </p>
          </div>
          <Link
            href="/requests"
            className="flex items-center gap-1.5 rounded-lg border border-[#E8E0D8] bg-white px-3.5 py-2 text-sm font-medium text-[#2E2E38] shadow-sm hover:border-[#C5A47E] transition-colors min-h-[40px]"
          >
            Requests inbox
          </Link>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-[#7B2D42]/7">
              <span className="text-3xl">💍</span>
            </div>
            <h2 className="text-xl font-semibold text-[#7B2D42] mb-2 font-heading">
              No accepted matches yet
            </h2>
            <p className="text-sm text-[#6B6B76] max-w-xs mx-auto mb-6">
              When someone accepts your interest (or you accept theirs), they appear here.
            </p>
            <Link
              href="/requests"
              className="inline-flex items-center gap-2 bg-[#0E7C7B] hover:bg-[#149998] text-white text-sm font-semibold rounded-lg px-6 py-2.5 min-h-[44px] transition-colors"
            >
              Check Requests Inbox →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map(({ request, perspective }) => (
              <AcceptedMatchCard key={request.id} request={request} perspective={perspective} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
