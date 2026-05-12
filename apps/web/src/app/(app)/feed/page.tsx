import { cookies } from 'next/headers';
import Link from 'next/link';
import { Heart, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
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

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar filter — desktop inline, mobile bottom-sheet */}
          <FilterSheet
            title="Filters"
            description="Refine your match feed"
            desktopInline
          >
            <MaritalStatusFilterToggle initialPrefs={maritalPrefs} />
          </FilterSheet>

          {/* Main feed column */}
          <div className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">Your Matches</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {items.length > 0
                ? `${items.length} compatible profile${items.length !== 1 ? 's' : ''} found`
                : profileReady
                  ? 'Warming up your recommendations'
                  : 'Complete your profile to see matches'}
            </p>
          </div>
          {profileReady ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-muted">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {completeness}% profile
            </span>
          ) : null}
        </div>

        {feedFailed ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load your matches"
            description={`The match feed API returned an error (${feedRes.status}: ${feedRes.error}). Try refreshing the page or check the API status.`}
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
        ) : items.length === 0 ? (
          profileReady ? (
            <EmptyState
              icon={Heart}
              title="No matches yet — we're tuning your feed"
              description="Your profile looks great. We're matching you against fresh profiles as they join. New recommendations appear weekly. Meanwhile, you can browse vendors or review match requests."
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
          )
        ) : (
          <div
            role="feed"
            aria-busy="false"
            aria-label={`${items.length} match suggestions`}
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
