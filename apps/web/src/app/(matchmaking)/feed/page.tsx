import { cookies } from 'next/headers';
import Link from 'next/link';
import { Heart, Sparkles, ArrowRight } from 'lucide-react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { MatchCard } from '@/components/matchmaking/MatchCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface MeResponse {
  profileCompleteness: number;
}

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
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

export default async function MatchFeedPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const [feed, me] = await Promise.all([
    fetchAuth<{ items: MatchFeedItem[]; total: number } | MatchFeedItem[]>(
      '/api/v1/matchmaking/feed',
      token,
    ),
    fetchAuth<MeResponse>('/api/v1/profiles/me', token),
  ]);

  // Accept either shape — new envelope has { items, total, ... }; legacy cached
  // data may still be a raw array.
  const items: MatchFeedItem[] = Array.isArray(feed) ? feed : (feed?.items ?? []);
  const completeness = me?.profileCompleteness ?? 0;
  const profileReady = completeness >= 40;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
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

        {items.length === 0 ? (
          profileReady ? (
            <EmptyState
              icon={Heart}
              title="No matches yet — we're tuning your feed"
              description="Your profile looks great. We're matching you against fresh profiles as they join. New recommendations appear weekly. Meanwhile, you can browse vendors or review match requests."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild>
                    <Link href="/requests">
                      Check Requests
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/vendors">Browse Vendors</Link>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <MatchCard key={item.profileId} match={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
