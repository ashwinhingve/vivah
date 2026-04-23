import { cookies } from 'next/headers';
import Link from 'next/link';
import { Heart, Calendar, MailOpen, Gauge, Sparkles, Plus, Cake } from 'lucide-react';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { MatchCard } from '@/components/matching/MatchCard';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared';
import type { ProfileSectionCompletion, BookingSummary, WeddingSummary } from '@smartshaadi/types';

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

  const [profile, bookingsData, requestsData, feedData, weddingsData] = await Promise.all([
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
    fetchAuth<{ weddings: WeddingSummary[] }>('/api/v1/weddings', token),
  ]);

  const completeness = profile?.profileCompleteness ?? 0;
  const sections = profile?.sectionCompletion;
  const tier = profile?.premiumTier ?? 'FREE';

  const allBookings = bookingsData?.bookings ?? [];
  const upcomingBookings = allBookings.filter((b) => b.status === 'CONFIRMED').length;
  const pendingBookings = allBookings.filter((b) => b.status === 'PENDING').length;
  const pendingRequests = requestsData?.total ?? 0;
  const feed = feedData?.items ?? [];
  const myWedding = weddingsData?.weddings?.[0] ?? null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary font-heading">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Welcome back to Smart Shaadi</p>
          </div>
          {tier !== 'FREE' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-muted shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {tier}
            </span>
          )}
        </div>

        {/* 4-card stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsCard
            label="Active Matches"
            value={upcomingBookings}
            sub="confirmed"
            icon={Heart}
            variant="teal"
          />
          <StatsCard
            label="Bookings"
            value={pendingBookings}
            sub="pending"
            icon={Calendar}
            variant="warning"
          />
          <StatsCard
            label="Requests"
            value={pendingRequests}
            sub="received"
            icon={MailOpen}
            variant="gold"
          />
          <StatsCard
            label="Profile"
            value={`${completeness}%`}
            sub="complete"
            icon={Gauge}
            variant={completeness >= 70 ? 'success' : 'teal'}
          />
        </div>

        {/* My Wedding */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary font-heading">My Wedding</h2>
            {myWedding && (
              <Link href={`/weddings/${myWedding.id}`} className="text-xs font-medium text-teal hover:text-teal-hover">
                Open planner →
              </Link>
            )}
          </div>
          {myWedding ? (
            <WeddingCard wedding={myWedding} />
          ) : (
            <EmptyState
              icon={Cake}
              title="Start Planning Your Wedding"
              description="Create a wedding plan with budget, tasks, guest list, and RSVP tracking."
              action={
                <Button asChild>
                  <Link href="/weddings/new">Begin Your Journey →</Link>
                </Button>
              }
            />
          )}
        </div>

        {/* Completeness bar + CTA */}
        {sections ? (
          <CompletenessBar sections={sections} />
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-gold/30 bg-gradient-to-br from-surface via-surface to-gold/10 p-5 shadow-card">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-2xl"
            />
            <div className="relative flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-base font-semibold text-primary">
                  Complete your profile
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A complete profile gets 3× more matches
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/profile/personal">Start Profile →</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Recommended Matches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary font-heading">Recommended for You</h2>
            {feed.length > 0 && (
              <Link href="/matches" className="text-xs font-medium text-teal hover:text-teal-hover">
                See all →
              </Link>
            )}
          </div>
          {completeness < 40 ? (
            <EmptyState
              icon={Heart}
              title="Your perfect match is out there"
              description="Complete your profile to at least 40% to start seeing matches."
              action={
                <Button asChild>
                  <Link href="/profile/personal">Complete Profile →</Link>
                </Button>
              }
            />
          ) : feed.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Warming up your recommendations"
              description="No matches yet — we're tuning your feed and will have suggestions shortly."
            />
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

      {/* Mobile FAB — sits above bottom nav (nav is ~64px incl. safe-area) */}
      <Link
        href="/profile/personal"
        aria-label="Complete profile"
        className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white shadow-lg shadow-teal/30 transition-all hover:-translate-y-0.5 hover:bg-teal-hover hover:shadow-xl active:scale-95 sm:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Link>
    </main>
  );
}
