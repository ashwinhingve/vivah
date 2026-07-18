import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { LoanOffer } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { LendingClient } from './LendingClient.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const LENDING_LIVE = process.env['NEXT_PUBLIC_LENDING_LIVE'] === 'true';

interface OffersResponse {
  isLsp: boolean;
  offers: LoanOffer[];
  mock: boolean;
}

async function fetchOffers(): Promise<OffersResponse> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/lending/offers?context=BOOKING`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { isLsp: true, offers: [], mock: true };
    const json = (await res.json()) as { data?: OffersResponse };
    return json.data ?? { isLsp: true, offers: [], mock: true };
  } catch {
    return { isLsp: true, offers: [], mock: true };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'servicesLending.metadata' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';

export default async function LendingPage() {
  const t = await getTranslations('servicesLending');
  const { offers, mock } = await fetchOffers();
  // Not-live whenever the server is mocking OR the web build hasn't flipped live.
  const isPreview = mock || !LENDING_LIVE;

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />
          <LendingClient initialOffers={offers} isPreview={isPreview} />
        </PageTransition>
      </main>
    </div>
  );
}
