import Link from 'next/link';
import type { MatchFeedItem } from '@smartshaadi/types';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function tierLabel(tier: MatchFeedItem['compatibility']['tier']): string {
  switch (tier) {
    case 'excellent': return 'Excellent';
    case 'good':      return 'Good';
    case 'average':   return 'Average';
    case 'low':       return 'Low';
  }
}

function tierBadgeClasses(tier: MatchFeedItem['compatibility']['tier']): string {
  switch (tier) {
    case 'excellent':
      return 'bg-[#0E7C7B] text-white';
    case 'good':
      return 'bg-[#1848C8] text-white';
    case 'average':
      return 'bg-[#D97706] text-white';
    case 'low':
      return 'bg-[#64748B] text-white';
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MatchCard({ item }: { item: MatchFeedItem }) {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] overflow-hidden flex flex-col">
      {/* Photo */}
      <div className="relative aspect-square w-full bg-[#F0EAE2] flex items-center justify-center rounded-t-xl overflow-hidden">
        {item.photoKey ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.photoKey}
            alt={`Photo of ${item.name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#64748B]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-16 h-16 opacity-30"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* "New" badge */}
        {item.isNew && (
          <span className="absolute top-2 left-2 bg-[#0A1F4D] text-white text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide">
            New
          </span>
        )}

        {/* Compatibility score badge */}
        <span className="absolute top-2 right-2 bg-[#0E7C7B] text-white text-xs font-bold rounded-full px-2.5 py-1 shadow">
          {item.compatibility.totalScore}% Match
        </span>
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Name + Location */}
        <div>
          <h2
            className="text-base font-bold text-[#0A1F4D] leading-snug"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {item.name}, {item.age}
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">{item.city}</p>
        </div>

        {/* Guna score + tier */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{ color: '#C5A47E' }}
          >
            {item.compatibility.gunaScore}/36 Guna
          </span>
          <span
            className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${tierBadgeClasses(item.compatibility.tier)}`}
          >
            {tierLabel(item.compatibility.tier)}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={`/profiles/${item.profileId}`}
          className="mt-auto inline-flex items-center justify-center gap-1.5 bg-[#0E7C7B] hover:bg-[#149998] active:scale-95 text-white text-sm font-semibold rounded-lg px-4 min-h-[44px] transition-colors w-full text-center"
        >
          View Profile →
        </Link>
      </div>
    </article>
  );
}

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
              <MatchCard key={item.profileId} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
