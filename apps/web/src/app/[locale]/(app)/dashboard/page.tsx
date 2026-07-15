import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  Heart,
  Calendar,
  Mail,
  Gauge,
  Sparkles,
  Plus,
  Cake,
  MessageCircle,
  Store,
  Users,
  Search,
  Video,
} from 'lucide-react';

const VIDEO_CALL_RE = /Video call started/i;
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ProfileCompletenessCard } from '@/components/dashboard/ProfileCompletenessCard';
import { DashboardMatches } from '@/components/dashboard/DashboardMatches.client';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { ConversationAvatar } from '@/components/dashboard/ConversationAvatar.client';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileData {
  name: string;
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

function getGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getDisplayName(raw: string | null | undefined): string | null {
  const first = raw?.trim()?.split(/\s+/)[0];
  if (!first) return null;
  if (/^\+?\d[\d\s-]{6,}$/.test(first)) return null;
  return first;
}

function intlLocale(locale: string): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

function formatDatePill(d: Date, locale: string): string {
  return d.toLocaleDateString(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    numberingSystem: 'latn',
  } as Intl.DateTimeFormatOptions);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.metadata' });
  return { title: t('title') };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  const tChats = await getTranslations({ locale, namespace: 'chats' });
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
  const displayName = getDisplayName(profile?.name);

  const allBookings = bookingsData?.bookings ?? [];
  const upcomingBookings = allBookings.filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.eventDate) >= new Date(),
  );
  const pendingRequests = requestsData?.total ?? 0;
  const feed = feedData?.items ?? [];
  const myWedding = weddingsData?.weddings?.[0] ?? null;
  const recentChats = recentChatData?.items ?? [];

  const now = new Date();
  const greeting = t(`greeting.${getGreetingKey()}` as 'greeting.morning');
  const dateLocale = intlLocale(locale);
  const numFmt: Intl.NumberFormatOptions = { numberingSystem: 'latn' } as Intl.NumberFormatOptions;

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl lg:max-w-6xl px-4 py-6 space-y-7">

          {/* ── Hero Greeting ──────────────────────────────────── */}
          <FadeUp delay={0}>
            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-primary/5 via-surface to-gold/10 px-5 py-5 shadow-card sm:px-7 sm:py-6 lg:px-8 lg:py-7">
              {/* Decorative blob */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/8 blur-3xl"
              />
              {/* Row 1 — greeting + (right) date pill / tier; stacks on mobile, baseline-aligned row on sm+ */}
              <div className="relative flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <h1 className="font-heading text-[22px] sm:text-[28px] font-semibold leading-tight tracking-tight text-primary min-w-0">
                  {greeting}{displayName ? `, ${displayName}` : ''} <span aria-hidden="true">👋</span>
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                  {tier !== 'FREE' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-muted shadow-sm">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {tier}
                    </span>
                  )}
                  <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-2xs font-medium text-gold-muted">
                    {formatDatePill(now, locale)}
                  </span>
                </div>
              </div>

              {/* Row 2 — completeness label inline with progress bar */}
              {completeness < 100 && (
                <div className="relative mt-4 flex items-center gap-3">
                  <p className="shrink-0 text-xs font-medium text-muted-foreground">
                    {t('profileBar.completeText', { percent: completeness })}
                  </p>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gold/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal to-teal-hover transition-all duration-500"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                </div>
              )}
              {completeness < 70 && (
                <Link
                  href="/profile/personal"
                  className="mt-2 inline-block text-2xs font-semibold text-teal underline-offset-2 hover:underline"
                >
                  {t('profileBar.completeCta')}
                </Link>
              )}
            </div>
          </FadeUp>

          {/* ── Stat Cards ─────────────────────────────────────── */}
          <StaggerList className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
            <StatsCard
              label={t('stats.newMatches')}
              value={feed.length}
              sub={t('stats.inFeedToday')}
              icon={Heart}
              variant="teal"
              animDelayMs={0}
              href="/feed"
              emptyCta={{ label: t('stats.refinePreferences'), href: '/profile/preferences' }}
            />
            <StatsCard
              label={t('stats.requests')}
              value={pendingRequests}
              sub={t('stats.received')}
              icon={Mail}
              variant="gold"
              animDelayMs={100}
              href="/requests"
              emptyCta={{ label: t('stats.viewPastRequests'), href: '/requests' }}
            />
            <StatsCard
              label={t('stats.upcomingEvents')}
              value={upcomingBookings.length}
              sub={t('stats.confirmed')}
              icon={Calendar}
              variant={upcomingBookings.length > 0 ? 'success' : 'default'}
              animDelayMs={200}
              href="/bookings"
              emptyCta={{ label: t('stats.browseVendors'), href: '/vendors' }}
            />
            <StatsCard
              label={t('stats.profile')}
              valuePercent={completeness}
              value={`${completeness}%`}
              sub={t('stats.complete')}
              icon={Gauge}
              variant={completeness >= 70 ? 'success' : 'warning'}
              animDelayMs={300}
              href="/profile/personal"
            />
          </StaggerList>

          {/* ── Profile Completeness (single source) ───────────── */}
          {sections && completeness < 100 && (
            <FadeUp delay={0.08}>
              <ProfileCompletenessCard sections={sections} />
            </FadeUp>
          )}

          {/* ── Main column + Sidebar (two-column on lg+) ──────── */}
          <div className="space-y-7 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
            <div className="space-y-7 lg:col-span-2">

          {/* ── Today's Matches ────────────────────────────────── */}
          <FadeUp delay={0.1}>
            <SectionHeader
              title={t('todaysMatches.title')}
              viewAllHref="/feed"
              viewAllLabel={t('todaysMatches.seeAll')}
            />
            {completeness < 40 ? (
              <EmptyState
                icon={Heart}
                title={t('todaysMatches.emptyTitle')}
                description={t('todaysMatches.emptyBody')}
                action={
                  <Button asChild size="sm">
                    <Link href="/profile/personal">{t('todaysMatches.emptyCta')}</Link>
                  </Button>
                }
              />
            ) : feed.length === 0 ? (
              <EmptyState
                icon={Heart}
                title={t('todaysMatches.warmingTitle')}
                description={t('todaysMatches.warmingBody')}
              />
            ) : (
              <DashboardMatches items={feed.slice(0, 4)} />
            )}
          </FadeUp>

          {/* ── Upcoming Events (from bookings) ────────────────── */}
          <FadeUp delay={0.15}>
            <SectionHeader
              title={t('upcomingEvents.title')}
              viewAllHref="/bookings"
              viewAllLabel={t('upcomingEvents.allBookings')}
            />
            {upcomingBookings.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={t('upcomingEvents.emptyTitle')}
                description={t('upcomingEvents.emptyBody')}
                action={
                  <Button asChild size="sm">
                    <Link href="/vendors">{t('upcomingEvents.emptyCta')}</Link>
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
                      className="group flex items-center gap-3.5 rounded-2xl border border-gold/20 bg-surface px-4 py-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                    >
                      {/* Calendar block */}
                      <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-gold/30 bg-primary/5 text-center">
                        <span className="text-2xs font-bold uppercase tracking-wider text-primary/60">
                          {dateObj.toLocaleDateString(dateLocale, { month: 'short', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions)}
                        </span>
                        <span className="font-heading text-lg font-bold leading-none text-primary">
                          {dateObj.getDate()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                          {b.vendorName ?? t('upcomingEvents.fallbackName')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ₹{b.totalAmount.toLocaleString(dateLocale, numFmt)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-2xs font-semibold text-success">
                          {t('upcomingEvents.confirmed')}
                        </span>
                        {days <= 30 && (
                          <span className="text-2xs text-muted-foreground">
                            {days === 0 ? t('upcomingEvents.today') : t('upcomingEvents.daysAway', { days })}
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
              title={t('recentConversations.title')}
              viewAllHref="/chat"
              viewAllLabel={t('recentConversations.openChat')}
            />
            {recentChats.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title={t('recentConversations.emptyTitle')}
                description={t('recentConversations.emptyBody')}
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/feed">{t('recentConversations.emptyCta')}</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-gold/10 rounded-2xl border border-gold/20 bg-surface shadow-card overflow-hidden">
                {recentChats.map((c) => {
                  const other = c.other;
                  const photo = other?.primaryPhotoKey ? resolvePhotoUrl(other.primaryPhotoKey) : null;
                  const last = c.lastMessage;
                  const isVideoSystem =
                    last?.type === 'SYSTEM' && VIDEO_CALL_RE.test(last.content);
                  const preview = !last
                    ? tChats('tapToStart')
                    : last.type === 'PHOTO'
                    ? tChats('previewPhoto')
                    : isVideoSystem
                    ? tChats('previewVideoCall')
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
                          <ConversationAvatar src={photo} name={other?.firstName ?? ''} />
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
                              {other?.firstName ?? tChats('unknownName')}
                            </p>
                            {relTime && (
                              <span className="shrink-0 text-2xs text-muted-foreground">{relTime}</span>
                            )}
                          </div>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            {isVideoSystem && (
                              <Video className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                            )}
                            <span className="truncate">{preview}</span>
                          </p>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-2xs font-semibold text-teal">
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

            </div>

            <aside className="space-y-7 lg:col-span-1 lg:space-y-6 lg:self-start lg:sticky lg:top-20">

          {/* ── My Wedding ─────────────────────────────────────── */}
          <FadeUp delay={0.2}>
            <SectionHeader
              title={t('myWedding.title')}
              viewAllHref={myWedding ? `/weddings/${myWedding.id}` : undefined}
              viewAllLabel={t('myWedding.openPlanner')}
            />
            {myWedding ? (
              <WeddingCard wedding={myWedding} />
            ) : (
              <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-primary/5 to-gold/10 shadow-card">
                <EmptyState
                  icon={Cake}
                  title={t('myWedding.emptyTitle')}
                  description={t('myWedding.emptyBody')}
                  action={
                    <Button asChild>
                      <Link href="/weddings/new">{t('myWedding.emptyCta')}</Link>
                    </Button>
                  }
                />
              </div>
            )}
          </FadeUp>


          {/* ── Quick Actions Strip ────────────────────────────── */}
          <FadeUp delay={0.28}>
            <SectionHeader title={t('quickActionsInline.title')} />
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4 lg:grid-cols-1">
              {([
                { href: '/feed',         label: t('quickActionsInline.findMatches'),   icon: Search, variant: 'teal'     },
                { href: '/weddings/new', label: t('quickActionsInline.planWedding'),   icon: Cake,   variant: 'burgundy' },
                { href: '/vendors',      label: t('quickActionsInline.browseVendors'), icon: Users,  variant: 'gold'     },
                { href: '/store',        label: t('quickActionsInline.shopStore'),     icon: Store,  variant: 'charcoal' },
              ] as const).map(({ href, label, icon: Icon, variant }) => {
                const tint =
                  variant === 'teal'
                    ? 'border-teal/20 bg-teal/5 hover:bg-teal/10'
                    : variant === 'burgundy'
                    ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
                    : variant === 'gold'
                    ? 'border-gold/30 bg-gold/10 hover:bg-gold/20'
                    : 'border-foreground/15 bg-foreground/5 hover:bg-foreground/10';
                const iconColor =
                  variant === 'teal'
                    ? 'text-teal'
                    : variant === 'burgundy'
                    ? 'text-primary'
                    : variant === 'gold'
                    ? 'text-gold-muted'
                    : 'text-foreground';
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-2xl border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover ${tint}`}
                  >
                    <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </FadeUp>

            </aside>
          </div>

        </div>

        {/* Mobile FAB — profile complete */}
        <Link
          href="/profile/personal"
          aria-label={t('completeProfileAria')}
          className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white shadow-lg shadow-teal/30 transition-all hover:-translate-y-0.5 hover:bg-teal-hover hover:shadow-xl active:scale-95 sm:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </Link>
      </main>
    </PageTransition>
  );
}
