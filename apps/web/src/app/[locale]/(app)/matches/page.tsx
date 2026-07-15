import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { AcceptedMatchCard } from '@/components/matching/AcceptedMatchCard';
import type { MatchRequest, MatchRequestsResponse } from '@smartshaadi/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'matches.metadata' });
  return { title: t('title') };
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchRequests(token: string, direction: 'received' | 'sent'): Promise<MatchRequest[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/requests/${direction}?limit=100`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw = await res.json() as unknown;
    if (
      typeof raw === 'object' && raw !== null &&
      'success' in raw && (raw as Record<string, unknown>)['success'] === true
    ) {
      const data = (raw as { success: true; data: MatchRequestsResponse }).data;
      return data.requests;
    }
    return [];
  } catch {
    return [];
  }
}

async function getAcceptedMatches(token: string): Promise<{ request: MatchRequest; perspective: 'received' | 'sent' }[]> {
  const [received, sent] = await Promise.all([
    fetchRequests(token, 'received'),
    fetchRequests(token, 'sent'),
  ]);

  const seen = new Set<string>();
  const accepted: { request: MatchRequest; perspective: 'received' | 'sent' }[] = [];

  for (const r of received) {
    if (r.status === 'ACCEPTED' && !seen.has(r.id)) {
      seen.add(r.id);
      accepted.push({ request: r, perspective: 'received' });
    }
  }
  for (const r of sent) {
    if (r.status === 'ACCEPTED' && !seen.has(r.id)) {
      seen.add(r.id);
      accepted.push({ request: r, perspective: 'sent' });
    }
  }

  return accepted.sort((a, b) =>
    new Date(b.request.updatedAt).getTime() - new Date(a.request.updatedAt).getTime(),
  );
}

export default async function MatchesPage() {
  const t = await getTranslations('matches');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;

  const matches = token ? await getAcceptedMatches(token) : [];

  return (
    <main className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-screen-lg px-4 py-8">
        <PageHeader
          title={t('heading')}
          subtitle={matches.length > 0 ? t('subtitleCount', { count: matches.length }) : t('subtitleEmpty')}
          actions={
            <Link
              href="/requests"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:border-gold transition-colors min-h-[44px]"
            >
              {t('requestsInbox')}
            </Link>
          }
        />

        {matches.length === 0 ? (
          <EmptyState
            variant="no-matches"
            actionLabel={t('checkRequestsInbox')}
            actionHref="/requests"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map(({ request, perspective }) => (
              <AcceptedMatchCard key={request.id} request={request} perspective={perspective} />
            ))}
          </div>
        )}
      </PageTransition>
    </main>
  );
}
