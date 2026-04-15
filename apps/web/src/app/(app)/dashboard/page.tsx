import { cookies } from 'next/headers';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import type { ProfileSectionCompletion } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileData {
  profileCompleteness: number;
  sectionCompletion: ProfileSectionCompletion;
  premiumTier: string;
}

async function getProfileData(): Promise<ProfileData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data: ProfileData };
  return json.success ? json.data : null;
}

export default async function DashboardPage() {
  const profile = await getProfileData();
  const completeness = profile?.profileCompleteness ?? 0;
  const sections = profile?.sectionCompletion;
  const tier = profile?.premiumTier ?? 'FREE';

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

        {/* Recommended Matches — skeleton cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-lg font-semibold text-[#7B2D42]"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Recommended for You
            </h2>
            <span className="text-xs text-[#6B6B76]">Week 3</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[#E8E0D8] bg-white overflow-hidden"
              >
                {/* Photo placeholder */}
                <div className="aspect-[4/3] bg-gradient-to-br from-[#E8E0D8] to-[#F0EBE4] animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-[#E8E0D8] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[#F0EBE4] animate-pulse" />
                  <div className="h-8 w-full rounded-lg bg-[#F0EBE4] animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[#6B6B76] mt-3">
            Matching engine launches in Week 3 — complete your profile to be ready
          </p>
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
