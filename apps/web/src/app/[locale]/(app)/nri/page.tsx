import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Globe, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { ProfileCard } from '@/components/ui/ProfileCard.client';
import { resolvePhotoUrl } from '@/lib/photo';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface FetchResult<T> {
  data: T | null;
  status: number;
  error: string | null;
}

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

interface PageProps {
  searchParams?: Promise<{ refresh?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nri.metadata' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function NriBrowsePage({ searchParams }: PageProps) {
  const t = await getTranslations('nri');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const sp = (await searchParams) ?? {};
  const refresh = sp.refresh === '1' || sp.refresh === 'true';

  // Build the NRI-specific feed endpoint with filters
  const queryParams = new URLSearchParams();
  if (refresh) queryParams.append('refresh', '1');
  queryParams.append('nriOnly', 'true');
  const nriPath = `/api/v1/matchmaking/feed?${queryParams.toString()}`;

  const [feedRes] = await Promise.all([
    fetchAuth<{ items: MatchFeedItem[]; total: number } | MatchFeedItem[]>(nriPath, token),
  ]);

  const feedFailed = feedRes.error !== null;
  const items: MatchFeedItem[] = Array.isArray(feedRes.data)
    ? feedRes.data
    : (feedRes.data?.items ?? []);
  const total = Array.isArray(feedRes.data)
    ? feedRes.data.length
    : ((feedRes.data as { items: MatchFeedItem[]; total: number } | null)?.total ?? items.length);

  const feedSubtitle = items.length === 0
    ? t('subtitleEmpty')
    : total > 5
      ? t('subtitleCount', { total })
      : t('subtitleDefault');

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <FadeUp delay={0} className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Globe className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <PageHeader
                title={t('heading')}
                subtitle={feedSubtitle}
                className="mb-0"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/nri?refresh=1" aria-label={t('refreshFeed')}>
                <RefreshCw className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </FadeUp>

        {/* ── Content area ─────────────────────────────────────────────── */}
        {feedFailed ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('errorTitle')}
            description={`${t('errorBody')} (${feedRes.status}: ${feedRes.error})`}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link href="/nri?refresh=1">{t('forceRefresh')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/feed">{t('backToFeed')}</Link>
                </Button>
              </div>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={t('emptyTitle')}
            description={t('emptyBody')}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link href="/nri?refresh=1">
                    {t('refreshFeed')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/feed">{t('backToFeed')}</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <Link key={item.profileId} href={`/profiles/${item.profileId}`} className="block">
                <ProfileCard
                  name={item.name || 'Member'}
                  age={item.age}
                  city={item.city}
                  photoUrl={item.photoHidden ? null : resolvePhotoUrl(item.photoKey)}
                  isNew={item.isNew}
                  isVerified={item.isVerified}
                  compatibilityPct={item.compatibility?.totalScore}
                  gunaScore={
                    item.compatibility?.flags?.includes('guna_pending')
                      ? null
                      : item.compatibility?.gunaScore
                  }
                  manglik={item.manglik ?? null}
                  lastActiveAt={item.lastActiveAt ?? null}
                  distanceKm={item.distanceKm ?? null}
                />
              </Link>
            ))}
          </div>
        )}
      </PageTransition>
    </main>
  );
}
