/**
 * Smart Shaadi — MatchCard (Server Component)
 *
 * Renders a single match feed item card.
 * Props: { match: MatchFeedItem }
 *
 * Design tokens:
 *   Navy   #0A1F4D — name / headings
 *   Teal   #0E7C7B — compatibility badge bg
 *   Gold   #C5A47E — guna score text, "New" badge bg
 *   Muted  #64748B — secondary text
 */

import Link from 'next/link';
import type { MatchFeedItem } from '@smartshaadi/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    case 'excellent': return 'bg-[#0E7C7B] text-white';
    case 'good':      return 'bg-[#1848C8] text-white';
    case 'average':   return 'bg-[#D97706] text-white';
    case 'low':       return 'bg-[#64748B] text-white';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchFeedItem;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] overflow-hidden flex flex-col">
      {/* Photo area */}
      <div className="relative aspect-square w-full bg-[#F0EAE2] flex items-center justify-center rounded-t-xl overflow-hidden">
        {match.photoKey ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={match.photoKey}
            alt={`Photo of ${match.name}`}
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
        {match.isNew && (
          <span className="absolute top-2 left-2 bg-[#C5A47E] text-white text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide">
            New
          </span>
        )}

        {/* Compatibility score badge */}
        <span className="absolute top-2 right-2 bg-[#0E7C7B] text-white text-xs font-bold rounded-full px-2.5 py-1 shadow">
          {match.compatibility.totalScore}% Match
        </span>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Name, age, city */}
        <div>
          <h2
            className="text-base font-bold text-[#0A1F4D] leading-snug"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {match.name}, {match.age}
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">{match.city}</p>
        </div>

        {/* Guna score + tier badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: '#C5A47E' }}>
            {match.compatibility.gunaScore}/36 Guna
          </span>
          <span
            className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${tierBadgeClasses(match.compatibility.tier)}`}
          >
            {tierLabel(match.compatibility.tier)}
          </span>
        </div>

        {/* Actions — form wrappers with placeholder actions (no onClick, Server Component) */}
        <div className="mt-auto flex gap-2">
          <form action="#" className="flex-1">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 bg-[#0E7C7B] hover:bg-[#149998] active:scale-95 text-white text-sm font-semibold rounded-lg px-4 min-h-[44px] transition-colors"
            >
              Accept
            </button>
          </form>
          <form action="#" className="flex-1">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 border border-[#E8E0D8] hover:border-[#0A1F4D] text-[#0A1F4D] text-sm font-semibold rounded-lg px-4 min-h-[44px] transition-colors"
            >
              Decline
            </button>
          </form>
        </div>

        {/* View profile link */}
        <Link
          href={`/profiles/${match.profileId}`}
          className="inline-flex items-center justify-center gap-1.5 text-[#1848C8] text-xs font-medium hover:underline"
        >
          View full profile →
        </Link>
      </div>
    </article>
  );
}
