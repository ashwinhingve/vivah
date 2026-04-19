import { cookies } from 'next/headers';
import Link from 'next/link';
import type { MatchFeedItem } from '@smartshaadi/types';
import { MatchCard } from '@/components/matchmaking/MatchCard';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getFeed(): Promise<MatchFeedItem[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/feed`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: MatchFeedItem[] };
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-20 h-20 rounded-full bg-[#0E7C7B]/10 flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0E7C7B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-10 h-10"
          aria-hidden="true"
        >
          <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#7B2D42] mb-2 font-heading">No matches yet</h2>
      <p className="text-sm text-[#6B6B76] max-w-xs mb-6">
        Complete your profile to unlock your matches — a fuller profile gets 3× more results.
      </p>
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 bg-[#0E7C7B] hover:bg-[#149998] text-white text-sm font-semibold rounded-lg px-6 min-h-[44px] transition-colors"
      >
        Complete Profile →
      </Link>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function MatchFeedPage() {
  const feed = await getFeed();

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">Your Matches</h1>
            <p className="text-sm text-[#6B6B76] mt-0.5">
              {feed.length > 0
                ? `${feed.length} compatible profile${feed.length !== 1 ? 's' : ''} found`
                : 'Complete your profile to see matches'}
            </p>
          </div>
        </div>

        {feed.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feed.map((item) => (
              <MatchCard key={item.profileId} match={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
