import Link from 'next/link';
import type { MatchFeedItem } from '@smartshaadi/types';
import { MatchCard } from '@/components/matchmaking/MatchCard';

// ── Mock data (replaced by real API in Phase B) ────────────────────────────────
const mockFeed: MatchFeedItem[] = [
  {
    profileId: '1',
    name: 'Priya Sharma',
    age: 27,
    city: 'Pune',
    compatibility: {
      totalScore: 87,
      breakdown: {
        demographicAlignment:   { score: 22, max: 25 },
        lifestyleCompatibility: { score: 17, max: 20 },
        careerEducation:        { score: 13, max: 15 },
        familyValues:           { score: 19, max: 20 },
        preferenceOverlap:      { score: 14, max: 20 },
      },
      gunaScore: 28,
      tier: 'excellent',
      flags: [],
    },
    photoKey: null,
    isNew: true,
  },
  {
    profileId: '2',
    name: 'Ananya Kulkarni',
    age: 25,
    city: 'Nashik',
    compatibility: {
      totalScore: 74,
      breakdown: {
        demographicAlignment:   { score: 18, max: 25 },
        lifestyleCompatibility: { score: 15, max: 20 },
        careerEducation:        { score: 12, max: 15 },
        familyValues:           { score: 16, max: 20 },
        preferenceOverlap:      { score: 13, max: 20 },
      },
      gunaScore: 22,
      tier: 'good',
      flags: [],
    },
    photoKey: null,
    isNew: false,
  },
  {
    profileId: '3',
    name: 'Sneha Patil',
    age: 29,
    city: 'Mumbai',
    compatibility: {
      totalScore: 61,
      breakdown: {
        demographicAlignment:   { score: 15, max: 25 },
        lifestyleCompatibility: { score: 12, max: 20 },
        careerEducation:        { score: 10, max: 15 },
        familyValues:           { score: 14, max: 20 },
        preferenceOverlap:      { score: 10, max: 20 },
      },
      gunaScore: 18,
      tier: 'average',
      flags: [],
    },
    photoKey: null,
    isNew: false,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {/* Illustration */}
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

      <h2
        className="text-xl font-bold text-[#0A1F4D] mb-2"
        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
      >
        No matches yet
      </h2>
      <p className="text-sm text-[#64748B] max-w-xs mb-6">
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

export default function MatchFeedPage() {
  const feed = mockFeed;

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[#0A1F4D]"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Your Matches
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              {feed.length > 0
                ? `${feed.length} compatible profile${feed.length !== 1 ? 's' : ''} found`
                : 'Complete your profile to see matches'}
            </p>
          </div>
        </div>

        {/* Match grid or empty state */}
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
