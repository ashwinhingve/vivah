import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Heart, Sparkles, ArrowRight, AlertTriangle, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { FeedPageClient } from './FeedPageClient.client';
import { MatchCard } from '@/components/matching/MatchCard';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────

type MaritalStatusValue = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface MeResponse {
  profileCompleteness: number;
}

interface PrefsResponse {
  maritalStatus?: MaritalStatusValue[];
}

interface FetchResult<T> {
  data: T | null;
  status: number;
  error: string | null;
}

// ─── Server-side auth fetch ───────────────────────────────────────────────────

async function fetchAuth<T>(path: string, token: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    const text = await res.text();
    let json: { success?: boolean; data?: T; error?: { message?: string } } = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
    if (!res.ok) {
      return { data: null, status: res.status, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return {
      data: json.success ? (json.data ?? null) : null,
      status: res.status,
      error: json.success ? null : (json.error?.message ?? 'API returned success=false'),
    };
  } catch (e) {
    return { data: null, status: 0, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams?: Promise<{ refresh?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'feed.metadata' });
  return { title: t('title') };
}

export default async function MatchFeedPage({ searchParams }: PageProps) {
  const t = await getTranslations('feed');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const sp = (await searchParams) ?? {};
  const refresh = sp.refresh === '1' || sp.refresh === 'true';
  const feedPath = refresh ? '/api/v1/matchmaking/feed?refresh=1' : '/api/v1/matchmaking/feed';

  const [feedRes, meRes, prefsRes] = await Promise.all([
    fetchAuth<{ items: MatchFeedItem[]; total: number } | MatchFeedItem[]>(feedPath, token),
    fetchAuth<MeResponse>('/api/v1/profiles/me', token),
    fetchAuth<PrefsResponse>('/api/v1/profiles/me/preferences', token),
  ]);

  const feedFailed = feedRes.error !== null;
  const items: MatchFeedItem[] = Array.isArray(feedRes.data)
    ? feedRes.data
    : (feedRes.data?.items ?? []);
  const total = Array.isArray(feedRes.data)
    ? feedRes.data.length
    : ((feedRes.data as { items: MatchFeedItem[]; total: number } | null)?.total ?? items.length);
  const completeness = meRes.data?.profileCompleteness ?? 0;
  const profileReady = completeness >= 40;
  const maritalPrefs = prefsRes.data?.maritalStatus ?? [];

  // Pre-compute available cities from first-page items to seed city filter
  const availableCities = [...new Set(items.map((i) => i.city).filter(Boolean))].sort();

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <FadeUp delay={0} className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[22px] sm:text-[28px] font-semibold leading-tight tracking-tight text-primary">{t('heading')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {items.length === 0
                ? profileReady
                  ? 'Warming up your recommendations'
                  : 'Complete your profile to see matches'
                : total > 5
                  ? `${total} compatible profiles · Refreshed daily`
                  : 'Refreshing daily · More matches as our community grows'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profileReady && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-muted">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {completeness}% complete
              </span>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/profile/preferences">Refine Preferences</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/feed?refresh=1" aria-label="Refresh feed">
                <RefreshCw className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </FadeUp>

        {/* ── Content area ─────────────────────────────────────────────── */}
        {feedFailed ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load your matches"
            description={`The match feed returned an error (${feedRes.status}: ${feedRes.error}). Try refreshing the page.`}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link href="/feed?refresh=1">Force Refresh</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            }
          />
        ) : !profileReady ? (
          <EmptyState
            icon={Sparkles}
            title="Complete your profile to unlock matches"
            description={`Your profile is ${completeness}% complete. A fuller profile gets 3× more results — add a few more details to start seeing recommendations.`}
            action={
              <Button asChild>
                <Link href="/profile/personal">
                  Complete Profile
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        ) : items.length === 1 ? (
          (() => {
            const only = items[0]!;
            const chips = [
              { label: 'Diet',    href: '/profile/preferences#diet' },
              { label: 'Manglik', href: '/profile/preferences#manglik' },
              { label: 'Age',     href: '/profile/preferences#age' },
              { label: 'City',    href: '/profile/preferences#city' },
            ];
            return (
              <div className="mx-auto flex max-w-md flex-col items-stretch gap-5">
                <div className="-mx-1 flex flex-wrap gap-2 px-1">
                  {chips.map((c) => (
                    <Link
                      key={c.label}
                      href={c.href}
                      className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-surface px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-teal hover:text-teal"
                    >
                      <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                      {c.label}
                    </Link>
                  ))}
                </div>
                <span className="self-center inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Recommended
                </span>
                <div className="mx-auto w-full max-w-[320px]">
                  <MatchCard
                    id={only.profileId}
                    name={only.name || 'Member'}
                    age={only.age}
                    city={only.city}
                    {...(only.photoKey ? { primaryPhotoUrl: only.photoKey } : {})}
                    compatibilityPct={only.compatibility?.totalScore}
                    isVerified={only.isVerified}
                    gunaPending={only.compatibility?.flags?.includes('guna_pending')}
                    hideGunaHint
                  />
                </div>
                <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-surface to-teal/5 p-5 text-center shadow-card">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
                    <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="font-heading text-lg font-semibold text-primary">Want more matches?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Broaden your partner preferences to unlock more compatible profiles.
                  </p>
                  <Button asChild className="mt-3">
                    <Link href="/profile/preferences">
                      Refine Preferences
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })()
        ) : items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No matches yet"
            description="We're growing carefully — more verified profiles join daily. Refine your preferences or check back tomorrow."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link href="/feed?refresh=1">
                    Refresh Feed
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/requests">Check Requests</Link>
                </Button>
              </div>
            }
          />
        ) : (
          /*
           * FeedPageClient holds shared FeedFilters state.
           * - Desktop: DesktopFilterSidebar (hidden on mobile) renders sidebar
           * - Mobile: MatchFeed renders a Sheet with the same filter UI
           * Both share the same filter state via FeedPageClient.
           *
           * KEY ARCHITECTURAL NOTES:
           * - ALL filtering is client-side (no server filter API)
           * - Pass/hide is client-only (no /hide endpoint)
           * - Shortlist syncs to POST/DELETE /matchmaking/shortlists/:id
           */
          <FeedPageClient
            initialItems={items}
            total={total}
            maritalPrefs={maritalPrefs}
            availableCities={availableCities}
          />
        )}
      </PageTransition>
    </main>
  );
}
