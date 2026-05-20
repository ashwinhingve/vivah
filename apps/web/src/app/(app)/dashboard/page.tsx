import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  Heart,
  Calendar,
  MailOpen,
  Gauge,
  Sparkles,
  Plus,
  Cake,
  MessageCircle,
  Store,
  Users,
  Search,
} from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { MatchCard } from '@/components/matching/MatchCard';
import { StrengthTipsPanel } from '@/components/profile/StrengthTipsPanel';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';
import type {
  ProfileSectionCompletion,
  BookingSummary,
  WeddingSummary,
  ConversationListItem as ConvItem,
} from '@smartshaadi/types';
import { resolvePhotoUrl } from '@/lib/photo';
import { formatRelativeIN } from '@/lib/format';

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDatePill(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const [profile, bookingsData, requestsData, feedData, weddingsData, recentChatData] = await Promise.all([
    fetchAuth<ProfileData>('/api/v1/profiles/me', token),
    fetchAuth<{ bookings: BookingSummary[]; total: number }>(
      '/api/v1/bookings?role=customer&limit=50',
      token,
    ),
    fetchAuth<{ requests: Array<{ status: string }>; total: number }>(
      '/api/v1/matchmaking/requests/received?limit=50',
      token,
    ),
    fetchAuth<{ items: FeedItem[] }>('/api/v1/matchmaking/feed?limit=4', token),
    fetchAuth<{ weddings: WeddingSummary[] }>('/api/v1/weddings', token),
    // P1-7 (docs/PHASE-1-4-AUDIT.md): wired Recent Conversations card.
    fetchAuth<{ items: ConvItem[] }>('/api/v1/chat/recent?limit=3', token),
  ]);

  const completeness = profile?.profileCompleteness ?? 0;
  const sections = profile?.sectionCompletion;
  const tier = profile?.premiumTier ?? 'FREE';

  const allBookings = bookingsData?.bookings ?? [];
  const upcomingBookings = allBookings.filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.eventDate) >= new Date(),
  );
  const pendingRequests = requestsData?.total ?? 0;
  const feed = feedData?.items ?? [];
  const myWedding = weddingsData?.weddings?.[0] ?? null;
  const recentChats = recentChatData?.items ?? [];

  const now = new Date();

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-7">

          {/* ── Hero Greeting ──────────────────────────────────── */}
          <FadeUp delay={0}>
            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-primary/5 via-surface to-gold/10 px-5 py-5 shadow-card">
              {/* Decorative blob */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/8 blur-3xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-gold-muted">
                      {formatDatePill(now)}
                    </span>
                  </div>
                  <h1 className="font-heading text-[22px] sm:text-[28px] font-semibold leading-tight tracking-tight text-primary">
                    {getGreeting()} 👋
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Welcome back to Smart Shaadi
                  </p>
                </div>

                {tier !== 'FREE' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-muted shadow-sm shrink-0">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {tier}
                  </span>
                )}
              </div>

              {/* Completeness progress bar */}
              {completeness < 100 && (
                <div className="relative mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Profile strength</p>
                    <p className="text-xs font-semibold text-teal">{completeness}%</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gold/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal to-teal-hover transition-all duration-500"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                  {completeness < 70 && (
                    <Link
                      href="/profile/personal"
                      className="mt-2 inline-block text-[11px] font-semibold text-teal underline-offset-2 hover:underline"
                    >
                      Complete your profile to unlock more matches →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </FadeUp>

          {/* ── Stat Cards ─────────────────────────────────────── */}
          <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatsCard
              label="New Matches"
              value={feed.length}
              sub="in feed today"
              icon={Heart}
              variant="teal"
            />
            <StatsCard
              label="Requests"
              value={pendingRequests}
              sub="received"
              icon={MailOpen}
              variant="gold"
            />
            <StatsCard
              label="Upcoming Events"
              value={upcomingBookings.length}
              sub="confirmed"
              icon={Calendar}
              variant={upcomingBookings.length > 0 ? 'success' : 'default'}
            />
            <StatsCard
              label="Profile"
              value={`${completeness}%`}
              sub="complete"
              icon={Gauge}
              variant={completeness >= 70 ? 'success' : 'warning'}
            />
          </StaggerList>

          {/* ── Today's Matches ────────────────────────────────── */}
          <FadeUp delay={0.1}>
            <SectionHeader
              title="Today's Matches"
              viewAllHref="/feed"
              viewAllLabel="See all"
            />
            {completeness < 40 ? (
              <EmptyState
                icon={Heart}
                title="Your perfect match is out there"
                description="Complete your profile to at least 40% to start seeing matches."
                action={
                  <Button asChild size="sm">
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
              /* Horizontal scroll on mobile, 4-col grid on md+ */
              <div className="-mx-4 px-4 overflow-x-auto pb-1 sm:mx-0 sm:px-0 sm:overflow-visible">
                <div className="flex gap-3 sm:grid sm:grid-cols-4">
                  {feed.slice(0, 4).map((item) => (
                    <div key={item.profileId} className="w-44 shrink-0 sm:w-auto">
                      <MatchCard
                        id={item.profileId}
                        name={item.name || 'Member'}
                        age={item.age}
                        city={item.city}
                        compatibilityPct={item.compatibility?.totalScore}
                        gunaPending={item.compatibility?.flags?.includes('guna_pending')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FadeUp>

          {/* ── Upcoming Events (from bookings) ────────────────── */}
          <FadeUp delay={0.15}>
            <SectionHeader
              title="Upcoming Events"
              viewAllHref="/bookings"
              viewAllLabel="All bookings"
            />
            {upcomingBookings.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No upcoming events"
                description="Discover trusted vendors and book them for your big day."
                action={
                  <Button asChild size="sm">
                    <Link href="/vendors">Browse Vendors →</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {upcomingBookings.slice(0, 4).map((b) => {
                  const days = daysUntil(b.eventDate);
                  const dateObj = new Date(b.eventDate);
                  return (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      className="group flex items-center gap-3.5 rounded-xl border border-gold/20 bg-surface px-4 py-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                    >
                      {/* Calendar block */}
                      <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-gold/30 bg-primary/5 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">
                          {dateObj.toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                        <span className="font-heading text-lg font-bold leading-none text-primary">
                          {dateObj.getDate()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                          {b.vendorName ?? 'Booking'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ₹{b.totalAmount.toLocaleString('en-IN')}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          Confirmed
                        </span>
                        {days <= 30 && (
                          <span className="text-[10px] text-muted-foreground">
                            {days === 0 ? 'Today' : `${days}d away`}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </FadeUp>

          {/* ── Recent Conversations (P1-7 — wired) ─────────────── */}
          <FadeUp delay={0.18}>
            <SectionHeader
              title="Recent Conversations"
              viewAllHref="/chat"
              viewAllLabel="Open chat"
            />
            {recentChats.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No conversations yet"
                description="When you and a match connect, your chats will appear here."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/feed">Find Matches →</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-gold/10 rounded-2xl border border-gold/20 bg-surface shadow-card overflow-hidden">
                {recentChats.map((c) => {
                  const other = c.other;
                  const photo = other?.primaryPhotoKey ? resolvePhotoUrl(other.primaryPhotoKey) : null;
                  const initial = (other?.firstName ?? '?').charAt(0).toUpperCase();
                  const last = c.lastMessage;
                  const preview = !last
                    ? 'Tap to start the conversation'
                    : last.type === 'PHOTO'
                    ? '📷 Photo'
                    : last.content.length > 60
                    ? `${last.content.slice(0, 60)}…`
                    : last.content;
                  const relTime = last ? formatRelativeIN(last.sentAt) : '';
                  return (
                    <li key={c.matchRequestId}>
                      <Link
                        href={`/chat/${c.matchRequestId}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background"
                      >
                        <div className="relative shrink-0">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt={other?.firstName ?? 'Profile photo'}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 font-heading text-sm font-semibold text-primary">
                              {initial}
                            </div>
                          )}
                          {other?.isOnline && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success"
                              aria-label="Online"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {other?.firstName ?? 'Unknown'}
                            </p>
                            {relTime && (
                              <span className="shrink-0 text-[11px] text-muted-foreground">{relTime}</span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{preview}</p>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-semibold text-teal">
                            {c.unreadCount > 9 ? '9+' : c.unreadCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </FadeUp>

          {/* ── My Wedding ─────────────────────────────────────── */}
          <FadeUp delay={0.2}>
            <SectionHeader
              title="My Wedding"
              viewAllHref={myWedding ? `/weddings/${myWedding.id}` : undefined}
              viewAllLabel="Open planner"
            />
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
          </FadeUp>

          {/* ── Profile Strength Tips ──────────────────────────── */}
          <FadeUp delay={0.22}>
            <StrengthTipsPanel />
          </FadeUp>

          {/* ── Completeness Bar ───────────────────────────────── */}
          {sections && (
            <FadeUp delay={0.25}>
              <CompletenessBar sections={sections} />
            </FadeUp>
          )}

          {/* ── Quick Actions Strip ────────────────────────────── */}
          <FadeUp delay={0.28}>
            <SectionHeader title="Quick Actions" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                { href: '/feed',           label: 'Find Matches',   icon: Search,         variant: 'teal'    },
                { href: '/weddings/new',   label: 'Plan Wedding',   icon: Cake,           variant: 'gold'    },
                { href: '/vendors',        label: 'Browse Vendors', icon: Users,          variant: 'default' },
                { href: '/store',          label: 'Shop Store',     icon: Store,          variant: 'default' },
              ] as const).map(({ href, label, icon: Icon, variant }) => (
                <Link
                  key={href}
                  href={href}
                  className={`group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover ${
                    variant === 'teal'
                      ? 'border-teal/20 bg-teal/5 hover:bg-teal/10'
                      : variant === 'gold'
                      ? 'border-gold/30 bg-gold/10 hover:bg-gold/20'
                      : 'border-gold/20 bg-surface hover:bg-gold/5'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${variant === 'teal' ? 'text-teal' : variant === 'gold' ? 'text-gold-muted' : 'text-primary'}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </FadeUp>

        </div>

        {/* Mobile FAB — profile complete */}
        <Link
          href="/profile/personal"
          aria-label="Complete profile"
          className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white shadow-lg shadow-teal/30 transition-all hover:-translate-y-0.5 hover:bg-teal-hover hover:shadow-xl active:scale-95 sm:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </Link>
      </main>
    </PageTransition>
  );
}
