/**
 * Smart Shaadi — MatchCard (Server Component)
 *
 * Renders a single match feed item card.
 * Props: { match: MatchFeedItem }
 *
 * Design tokens:
 *   Burgundy #7B2D42 — name / headings
 *   Teal     #0E7C7B — compatibility badge bg
 *   Gold     #C5A47E — guna score text, "New" badge bg
 *   Muted    #6B6B76 — secondary text
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
    case 'good':      return 'bg-[#059669] text-white';
    case 'average':   return 'bg-[#D97706] text-white';
    case 'low':       return 'bg-[#6B6B76] text-white';
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
      <div className="relative aspect-square w-full rounded-t-xl overflow-hidden border-x-2 border-t-2 border-[#C5A47E]">
        {match.photoKey ? (
          <img
            src={match.photoKey}
            alt={`Photo of ${match.name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7B2D42 0%, #C5A47E 100%)' }}
          >
            <span className="text-4xl font-semibold text-white font-heading" aria-hidden="true">
              {match.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
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
          <h2 className="text-base font-bold text-[#7B2D42] leading-snug font-heading">
            {match.name}, {match.age}
          </h2>
          <p className="text-xs text-[#6B6B76] mt-0.5">{match.city}</p>
        </div>

        {/* Guna score + tier badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#9E7F5A] bg-[#C5A47E]/15 rounded-full px-2.5 py-0.5">
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
              className="w-full inline-flex items-center justify-center gap-1.5 border border-[#E8E0D8] hover:border-[#7B2D42] text-[#2E2E38] text-sm font-semibold rounded-lg px-4 min-h-[44px] transition-colors"
            >
              Decline
            </button>
          </form>
        </div>

        {/* View profile link */}
        <Link
          href={`/profiles/${match.profileId}`}
          className="inline-flex items-center justify-center gap-1.5 text-[#0E7C7B] text-xs font-medium hover:underline"
        >
          View full profile →
        </Link>
      </div>
    </article>
  );
}
