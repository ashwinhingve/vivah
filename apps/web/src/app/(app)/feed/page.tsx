import { cookies } from 'next/headers';
import Link from 'next/link';
import { Heart, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { MatchFeedItem } from '@smartshaadi/types';
import { MatchCard } from '@/components/matchmaking/MatchCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared';
import { MaritalStatusFilterToggle } from '@/components/feed/MaritalStatusFilterToggle.client';
import { FilterSheet } from '@/components/shared/FilterSheet.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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
      return {
        data: null,
        status: res.status,
        error: json.error?.message ?? `HTTP ${res.status}`,
      };
    }
    return {
      data: json.success ? (json.data ?? null) : null,
      status: res.status,
      error: json.success ? null : (json.error?.message ?? 'API returned success=false'),
    };
  } catch (e) {
    return {
      data: null,
      status: 0,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

interface PageProps {
  searchParams?: Promise<{ refresh?: string }>;
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
  const completeness = meRes.data?.profileCompleteness ?? 0;
  const profileReady = completeness >= 40;
  const maritalPrefs = prefsRes.data?.maritalStatus ?? [];

  const subtitle = items.length > 0
    ? (items.length === 1
        ? t('header.countSingular', { count: items.length })
        : t('header.countPlural', { count: items.length }))
    : profileReady
      ? t('header.warming')
      : t('header.completeProfile');

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar filter — desktop inline, mobile bottom-sheet */}
          <FilterSheet
            title={t('filters.title')}
            description={t('filters.description')}
            desktopInline
          >
            <MaritalStatusFilterToggle initialPrefs={maritalPrefs} />
          </FilterSheet>

          {/* Main feed column */}
          <div className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">{t('header.title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {profileReady ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-muted">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t('header.profileBadge', { percent: completeness })}
            </span>
          ) : null}
        </div>

        {feedFailed ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('errors.title')}
            description={t('errors.description', {
              status: feedRes.status,
              message: feedRes.error ?? '',
            })}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link href="/feed?refresh=1">{t('errors.forceRefresh')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard">{t('errors.backToDashboard')}</Link>
                </Button>
              </div>
            }
          />
        ) : items.length === 0 ? (
          profileReady ? (
            <EmptyState
              icon={Heart}
              title={t('empty.warming.title')}
              description={t('empty.warming.description')}
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild>
                    <Link href="/feed?refresh=1">
                      {t('empty.warming.refresh')}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/requests">{t('empty.warming.checkRequests')}</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title={t('empty.incomplete.title')}
              description={t('empty.incomplete.description', { percent: completeness })}
              action={
                <Button asChild>
                  <Link href="/profile/personal">
                    {t('empty.incomplete.cta')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <div
            role="feed"
            aria-busy="false"
            aria-label={t('ariaLabel', { count: items.length })}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((item) => (
              <MatchCard key={item.profileId} match={item} />
            ))}
          </div>
        )}
          </div>{/* end main feed column */}
        </div>{/* end flex gap-6 */}
      </div>
    </main>
  );
}
