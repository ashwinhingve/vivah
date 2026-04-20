import { cookies } from 'next/headers';
import Link from 'next/link';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { MatchCard } from '@/components/matching/MatchCard';
import type { ProfileSectionCompletion, BookingSummary } from '@smartshaadi/types';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileData {
  profileCompleteness: number;
  sectionCompletion: ProfileSectionCompletion;
  premiumTier: string;
}

interface FeedItem {
  profileId: string;
  name: string;
  age: number | null;
  city: string;
  photoKey: string | null;
  compatibility: { totalScore: number; flags: string[] };
}

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const [profile, bookingsData, requestsData, feedData] = await Promise.all([
    fetchAuth<ProfileData>('/api/v1/profiles/me', token),
    fetchAuth<{ bookings: BookingSummary[]; total: number }>(
      '/api/v1/bookings?role=customer&limit=50',
      token,
    ),
    fetchAuth<{ requests: Array<{ status: string }>; total: number }>(
      '/api/v1/matchmaking/requests/received?limit=50',
      token,
    ),
    fetchAuth<{ items: FeedItem[] }>('/api/v1/matchmaking/feed?limit=3', token),
  ]);

  const completeness = profile?.profileCompleteness ?? 0;
  const sections = profile?.sectionCompletion;
  const tier = profile?.premiumTier ?? 'FREE';

  const allBookings = bookingsData?.bookings ?? [];
  const upcomingBookings = allBookings.filter((b) => b.status === 'CONFIRMED').length;
  const pendingBookings = allBookings.filter((b) => b.status === 'PENDING').length;
  const pendingRequests = requestsData?.total ?? 0;
  const feed = feedData?.items ?? [];

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">Dashboard</h1>
            <p className="text-sm text-[#6B6B76] mt-0.5">Welcome back to Smart Shaadi</p>
          </div>
          {tier !== 'FREE' && (
            <span className="rounded-full bg-[#FFF3E0] text-[#D97706] text-xs font-semibold px-3 py-1 border border-[#FDE68A]">
              {tier}
            </span>
          )}
        </div>

        {/* 4-card stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Active Matches</p>
            <p className="text-2xl font-bold font-heading text-[#0E7C7B]">{upcomingBookings}</p>
            <p className="text-xs text-[#6B6B76]">confirmed</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Bookings</p>
            <p className="text-2xl font-bold font-heading text-[#0E7C7B]">{pendingBookings}</p>
            <p className="text-xs text-[#6B6B76]">pending</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Requests</p>
            <p className="text-2xl font-bold font-heading text-[#0E7C7B]">{pendingRequests}</p>
            <p className="text-xs text-[#6B6B76]">received</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#6B6B76] font-medium uppercase tracking-wide">Profile</p>
            <p className={`text-2xl font-bold font-heading ${completeness >= 70 ? 'text-[#059669]' : 'text-[#0E7C7B]'}`}>
              {completeness}%
            </p>
            <p className="text-xs text-[#6B6B76]">complete</p>
          </div>
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
                  className="mt-3 inline-flex items-center gap-1.5 bg-[#0E7C7B] text-white text-sm font-semibold rounded-lg px-4 py-2 min-h-[44px] hover:bg-[#149998] transition-colors"
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
            <h2 className="text-lg font-semibold text-[#7B2D42] font-heading">Recommended for You</h2>
            {feed.length > 0 && (
              <Link href="/matches" className="text-xs font-medium text-[#0E7C7B] hover:text-[#149998]">
                See all →
              </Link>
            )}
          </div>
          {completeness < 40 ? (
            <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#7B2D42]/10 flex items-center justify-center mx-auto mb-4 text-2xl">
                💍
              </div>
              <p className="text-base font-semibold text-[#7B2D42] font-heading">
                Your perfect match is out there
              </p>
              <p className="text-sm text-[#6B6B76] mt-1 mb-4">
                Complete your profile to at least 40% to start seeing matches
              </p>
              <Link
                href="/profile/personal"
                className="inline-flex items-center gap-1.5 bg-[#0E7C7B] text-white text-sm font-semibold rounded-lg px-5 py-2.5 min-h-[44px] hover:bg-[#149998] transition-colors"
              >
                Complete Profile →
              </Link>
            </div>
          ) : feed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white p-8 text-center">
              <p className="text-sm text-[#6B6B76]">
                No matches yet. We&apos;re warming up your recommendations — check back shortly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {feed.slice(0, 3).map((item) => (
                <MatchCard
                  key={item.profileId}
                  id={item.profileId}
                  name={item.name || 'Member'}
                  age={item.age}
                  city={item.city}
                  compatibilityPct={item.compatibility?.totalScore}
                  gunaPending={item.compatibility?.flags?.includes('guna_pending')}
                />
              ))}
            </div>
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
