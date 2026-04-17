import { cookies } from 'next/headers';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { MatchCard } from '@/components/matching/MatchCard';
import type { ProfileSectionCompletion } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileData {
  profileCompleteness: number;
  sectionCompletion: ProfileSectionCompletion;
  premiumTier: string;
}

async function getProfileData(): Promise<{ data: ProfileData | null; error: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return { data: null, error: false };

  try {
    const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) return { data: null, error: true };
    const json = (await res.json()) as { success: boolean; data: ProfileData };
    return { data: json.success ? json.data : null, error: !json.success };
  } catch {
    return { data: null, error: true };
  }
}

export default async function DashboardPage() {
  const { data: profile, error: profileError } = await getProfileData();
  const completeness = profile?.profileCompleteness ?? 0;
  const sections = profile?.sectionCompletion;
  const tier = profile?.premiumTier ?? 'FREE';

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* API error banner */}
        {profileError && (
          <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
            Could not load your profile data. Please refresh the page or check your connection.
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">
              Dashboard
            </h1>
            <p className="text-sm text-[#6B6B76] mt-0.5">Welcome back to Smart Shaadi</p>
          </div>
          {tier !== 'FREE' && (
            <span className="rounded-full bg-[#FFF3E0] text-[#D97706] text-xs font-semibold px-3 py-1 border border-[#FDE68A]">
              {tier}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatsCard
            label="Profile"
            value={`${completeness}%`}
            sub="complete"
            accent={completeness >= 70}
          />
          <StatsCard label="Matches" value="—" sub="coming soon" />
          <StatsCard label="Bookings" value="—" sub="no bookings yet" />
        </div>

        {/* Completeness bar + CTA */}
        {sections ? (
          <CompletenessBar sections={sections} />
        ) : (
          <div className="rounded-xl border border-[#E8E0D8] bg-white p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#7B2D42]/10 flex items-center justify-center shrink-0 text-lg">
                📋
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#2E2E38]">Complete your profile</p>
                <p className="text-xs text-[#6B6B76] mt-0.5">A complete profile gets 3× more matches</p>
                <Link
                  href="/profile/personal"
                  className="mt-3 inline-flex items-center gap-1.5 bg-[#0E7C7B] text-white text-sm font-semibold rounded-lg px-4 py-2 min-h-[40px] hover:bg-[#149998] transition-colors"
                >
                  Start Profile →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recommended Matches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-lg font-semibold text-[#7B2D42]"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Recommended for You
            </h2>
          </div>
          {completeness < 40 ? (
            /* Empty state — profile too incomplete for matches */
            <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#7B2D42]/8 flex items-center justify-center mx-auto mb-4 text-2xl">
                💍
              </div>
              <p
                className="text-base font-semibold text-[#7B2D42]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Your perfect match is out there
              </p>
              <p className="text-sm text-[#6B6B76] mt-1 mb-4">
                Complete your profile to at least 40% to start seeing matches
              </p>
              <Link
                href="/profile/personal"
                className="inline-flex items-center gap-1.5 bg-[#0E7C7B] text-white text-sm font-semibold rounded-lg px-5 py-2.5 min-h-[40px] hover:bg-[#149998] transition-colors"
              >
                Complete Profile →
              </Link>
            </div>
          ) : (
            /* Skeleton cards — matching engine coming Week 3 */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <MatchCard key={i} skeleton />
                ))}
              </div>
              <p className="text-center text-xs text-[#6B6B76] mt-3">
                Matching engine launches in Week 3 — you&apos;re all set
              </p>
            </>
          )}
        </div>

        {/* Quick actions */}
        <QuickActions />

        {/* Activity feed */}
        <ActivityFeed />
      </div>

      {/* Mobile FAB */}
      <Link
        href="/profile/personal"
        aria-label="Complete profile"
        className="fixed bottom-6 right-4 z-40 sm:hidden w-14 h-14 rounded-full bg-[#0E7C7B] shadow-lg flex items-center justify-center text-white text-2xl hover:bg-[#149998] transition-colors active:scale-95"
      >
        +
      </Link>
    </main>
  );
}
