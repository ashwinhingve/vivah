import Link from 'next/link';
import { MatchCard } from '@/components/matching/MatchCard';

export const metadata = { title: 'Recommended Matches — Smart Shaadi' };

export default function MatchesPage() {
  // Week 3: matching engine will populate real data here.
  // For now: empty state + skeleton scaffold to validate layout.
  const hasMatches = false;
  const isLoading = false;

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-screen-lg px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">
              Recommended for You
            </h1>
            <p className="text-sm text-[#6B6B76] mt-0.5">
              Profiles matched to your preferences
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] bg-white px-3.5 py-2 text-sm font-medium text-[#2E2E38] shadow-sm hover:border-[#C5A47E] transition-colors min-h-[40px]"
          >
            <svg className="w-4 h-4 text-[#6B6B76]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filters
          </button>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCard key={i} skeleton />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasMatches && (
          <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white py-16 px-6 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: 'rgba(123,45,66,0.07)' }}
            >
              💍
            </div>
            <h2 className="text-xl font-semibold text-[#7B2D42] mb-2 font-heading">
              Your perfect match is out there
            </h2>
            <p className="text-sm text-[#6B6B76] max-w-xs mx-auto mb-6">
              Complete your profile to at least 40% so our matching engine can find your best-fit profiles.
            </p>
            <Link
              href="/profile/personal"
              className="inline-flex items-center gap-2 bg-[#0E7C7B] hover:bg-[#149998] text-white text-sm font-semibold rounded-lg px-6 py-2.5 min-h-[44px] transition-colors"
            >
              Complete Your Profile →
            </Link>
            <p className="mt-4 text-xs text-[#6B6B76]">
              Matching engine launches in Week 3
            </p>
          </div>
        )}

        {/* Match grid (Week 3 — populated from API) */}
        {!isLoading && hasMatches && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Real MatchCard components will be rendered here from API data */}
          </div>
        )}
      </div>
    </main>
  );
}
