import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { RoleHero } from '@/components/shared/RoleHero';
import {
  Calendar,
  Star,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  IndianRupee,
} from 'lucide-react';
import { BookingQueueList } from '@/components/vendor/BookingQueueList.client';
import { InquiriesInbox } from '@/components/vendor/InquiriesInbox.client';
import { BlockedDatesManager } from '@/components/vendor/BlockedDatesManager.client';
import { VendorProfileEditor } from '@/components/vendor/VendorProfileEditor.client';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RevenueSparkline } from '@/components/dashboard/RevenueSparkline.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { VendorStatusBanner } from './StatusBanner.client';
import type { BookingSummary, VendorInquiry, VendorBlockedDate, VendorProfile } from '@smartshaadi/types';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const TAB_VALUES = ['overview', 'inquiries', 'calendar', 'profile'] as const;

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch { return null; }
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/** Build a 30-day array from bookings (completed bookings by event date). */
function buildRevenueDays(bookings: BookingSummary[]): Array<{ date: string; amount: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map = new Map<string, number>();

  // Initialise all 30 days to 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
  }

  // Sum completed bookings by their event date
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 29);
  for (const b of bookings) {
    if (b.status !== 'COMPLETED') continue;
    const d = new Date(b.eventDate);
    d.setHours(0, 0, 0, 0);
    if (d >= cutoff && d <= today) {
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + b.totalAmount);
    }
  }

  return Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
}

function getCategoryLabel(cat: string): string {
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default async function VendorDashboardPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const tab = TAB_VALUES.includes(tabParam as (typeof TAB_VALUES)[number]) ? tabParam! : 'overview';

  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  // Belt-and-braces role guard (middleware also gates /vendor-dashboard).
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me', token);
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('vendorRole.dashboard');

  const [bookingsData, inquiriesData, blockedData, vendorMine] = await Promise.all([
    fetchAuth<{ bookings: BookingSummary[]; total: number }>('/api/v1/bookings?role=vendor&limit=100', token),
    fetchAuth<{ inquiries: VendorInquiry[]; total: number }>('/api/v1/vendors/inquiries?limit=50', token),
    fetchAuth<{ dates: VendorBlockedDate[] }>('/api/v1/vendors/blocked-dates', token),
    fetchAuth<VendorProfile>('/api/v1/vendors/me', token).catch(() => null),
  ]);

  const allBookings = bookingsData?.bookings ?? [];
  const inquiries   = inquiriesData?.inquiries ?? [];
  const blocked     = blockedData?.dates ?? [];

  // Resolve vendor profile via /vendors/:id when /me missing
  let vendorProfile = vendorMine;
  if (!vendorProfile && allBookings[0]?.vendorId) {
    vendorProfile = await fetchAuth<VendorProfile>(`/api/v1/vendors/${allBookings[0].vendorId}`, token);
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Stats
  const pendingCount       = allBookings.filter((b) => b.status === 'PENDING').length;
  const todayBookings      = allBookings.filter((b) => {
    const d = new Date(b.eventDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === now.getTime() && b.status === 'CONFIRMED';
  });
  const monthRevenue       = allBookings
    .filter((b) => b.status === 'COMPLETED' && new Date(b.eventDate) >= monthStart)
    .reduce((s, b) => s + b.totalAmount, 0);
  const newInquiries       = inquiries.filter((i) => i.status === 'NEW').length;

  const revenueDays = buildRevenueDays(allBookings);

  // Upcoming confirmed (future)
  const upcomingConfirmed = allBookings
    .filter((b) => b.status === 'CONFIRMED' && new Date(b.eventDate) >= now)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  const businessName = vendorProfile?.businessName ?? t('businessFallback');
  const categoryLabel = vendorProfile?.category ? getCategoryLabel(String(vendorProfile.category)) : null;

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        {/* P1-8: approval status banner (hidden when status === APPROVED) */}
        <VendorStatusBanner />
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">

          {/* ── Header ─────────────────────────────────────────── */}
          <RoleHero
            title={t('welcome', { name: businessName })}
            subtitle={categoryLabel || undefined}
            rightSlot={
              vendorProfile?.rating != null ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2">
                  <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                  <span className="font-heading text-sm font-bold text-gold-muted">
                    {vendorProfile.rating.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({vendorProfile.totalReviews})
                  </span>
                </div>
              ) : undefined
            }
          />

          {/* ── Tabs ───────────────────────────────────────────── */}
          <FadeUp delay={0.04}>
            <div className="-mx-1 overflow-x-auto px-1">
            <nav
              className="flex min-w-max gap-1.5 rounded-xl border border-gold/20 bg-surface p-1.5"
              aria-label={t('tabsAria')}
            >
              {TAB_VALUES.map((value) => (
                <Link
                  key={value}
                  href={`/vendor-dashboard?tab=${value}`}
                  className={`relative shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === value
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-gold/10 hover:text-foreground'
                  }`}
                >
                  {t(`tabs.${value}`)}
                  {value === 'inquiries' && newInquiries > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-white">
                      {newInquiries > 9 ? '9+' : newInquiries}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            </div>
          </FadeUp>

          {/* ══════════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <>
              {/* Pending actions callout */}
              {pendingCount > 0 && (
                <FadeUp delay={0.06}>
                  <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
                    <AlertCircle className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-primary">
                        {t('pendingCallout', { count: pendingCount })}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('pendingHint')}
                      </p>
                    </div>
                    <Link
                      href="/vendor-dashboard?tab=overview#pending"
                      className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                      {t('review')}
                    </Link>
                  </div>
                </FadeUp>
              )}

              {/* 4-card stat row */}
              <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatsCard
                  label={t('stats.todayEvents')}
                  value={todayBookings.length}
                  sub={t('stats.todayEventsSub')}
                  icon={Calendar}
                  variant={todayBookings.length > 0 ? 'success' : 'default'}
                />
                <StatsCard
                  label={t('stats.monthRevenue')}
                  value={`₹${monthRevenue >= 100_000 ? `${(monthRevenue / 100_000).toFixed(1)}L` : `${(monthRevenue / 1_000).toFixed(1)}k`}`}
                  sub={t('stats.monthRevenueSub')}
                  icon={IndianRupee}
                  variant="teal"
                />
                <StatsCard
                  label={t('stats.pending')}
                  value={pendingCount}
                  sub={t('stats.pendingSub')}
                  icon={Clock}
                  variant={pendingCount > 0 ? 'warning' : 'default'}
                />
                <StatsCard
                  label={t('stats.rating')}
                  value={vendorProfile?.rating?.toFixed(1) ?? '—'}
                  sub={t('stats.ratingSub', { count: vendorProfile?.totalReviews ?? 0 })}
                  icon={Star}
                  variant="gold"
                />
              </StaggerList>

              {/* 30-day revenue sparkline */}
              <FadeUp delay={0.14}>
                <RevenueSparkline data={revenueDays} />
              </FadeUp>

              {/* Today's bookings */}
              <FadeUp delay={0.18}>
                <SectionHeader
                  title={t('todaySchedule')}
                  viewAllHref="/vendor-dashboard?tab=overview"
                  viewAllLabel={t('allEvents')}
                />
                {todayBookings.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title={t('todayEmptyTitle')}
                    description={t('todayEmptyDesc')}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {todayBookings.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-3.5 rounded-xl border border-success/20 bg-success/5 px-4 py-3.5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
                          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {b.vendorName}
                          </p>
                          {b.ceremonyType && (
                            <p className="text-xs text-muted-foreground">{b.ceremonyType}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-success">
                            ₹{b.totalAmount.toLocaleString('en-IN')}
                          </p>
                          {b.eventLocation && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                              {b.eventLocation}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </FadeUp>

              {/* Upcoming confirmed events */}
              {upcomingConfirmed.length > 0 && (
                <FadeUp delay={0.22}>
                  <SectionHeader
                    title={t('upcomingTitle')}
                    subtitle={t('upcomingSubtitle')}
                  />
                  <div className="space-y-2">
                    {upcomingConfirmed.slice(0, 6).map((b) => {
                      const dateObj = new Date(b.eventDate);
                      return (
                        <div
                          key={b.id}
                          className="flex items-center gap-3.5 rounded-xl border border-gold/20 bg-surface px-4 py-3.5 shadow-card"
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
                            <p className="truncate text-sm font-semibold text-foreground">
                              {b.vendorName}
                            </p>
                            {b.ceremonyType && (
                              <p className="text-xs text-muted-foreground">{b.ceremonyType}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-teal">
                              ₹{b.totalAmount.toLocaleString('en-IN')}
                            </p>
                            <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                              {t('confirmed')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </FadeUp>
              )}

              {/* Pending bookings queue */}
              {pendingCount > 0 && (
                <FadeUp delay={0.26}>
                  <div id="pending">
                    <SectionHeader
                      title={t('pendingRequestsTitle')}
                      subtitle={t('pendingRequestsSubtitle', { count: pendingCount })}
                    />
                    <BookingQueueList initialBookings={allBookings.filter((b) => b.status === 'PENDING')} />
                  </div>
                </FadeUp>
              )}

              {/* Performance snapshot */}
              <FadeUp delay={0.3}>
                <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-surface to-gold/5 p-5 shadow-card">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-teal" aria-hidden="true" />
                    <h3 className="font-heading text-base font-semibold text-primary">{t('performanceTitle')}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="font-heading text-xl font-bold text-teal">
                        {allBookings.filter((b) => b.status === 'COMPLETED').length}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{t('performanceCompleted')}</p>
                    </div>
                    <div>
                      <p className="font-heading text-xl font-bold text-primary">
                        {allBookings.filter((b) => b.status === 'CONFIRMED').length}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{t('performanceConfirmed')}</p>
                    </div>
                    <div>
                      <p className="font-heading text-xl font-bold text-warning">
                        {pendingCount}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{t('performancePending')}</p>
                    </div>
                  </div>
                </div>
              </FadeUp>
            </>
          )}

          {tab === 'inquiries' && (
            <FadeUp delay={0.06}>
              <InquiriesInbox initial={inquiries} />
            </FadeUp>
          )}

          {tab === 'calendar' && (
            <FadeUp delay={0.06}>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('calendarHint')}
                </p>
                <BlockedDatesManager initial={blocked} />
              </div>
            </FadeUp>
          )}

          {tab === 'profile' && (
            <FadeUp delay={0.06}>
              {vendorProfile ? (
                <VendorProfileEditor vendor={vendorProfile} />
              ) : (
                <EmptyState
                  icon={AlertCircle}
                  title={t('profileMissingTitle')}
                  description={t('profileMissingDesc')}
                />
              )}
            </FadeUp>
          )}

        </div>
      </main>
    </PageTransition>
  );
}
