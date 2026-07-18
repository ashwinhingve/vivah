import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { InsuranceQuote, InsuranceSku } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { InsuranceClient } from './InsuranceClient.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const INSURANCE_LIVE = process.env['NEXT_PUBLIC_INSURANCE_LIVE'] === 'true';

interface QuotesResponse {
  quotes: InsuranceQuote[];
  leadSku: InsuranceSku;
  mock: boolean;
}

async function fetchQuotes(): Promise<QuotesResponse> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/insurance/quotes?context=BOOKING`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { quotes: [], leadSku: 'HEALTH', mock: true };
    const json = (await res.json()) as { data?: QuotesResponse };
    return json.data ?? { quotes: [], leadSku: 'HEALTH', mock: true };
  } catch {
    return { quotes: [], leadSku: 'HEALTH', mock: true };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'servicesInsurance.metadata' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';

export default async function InsurancePage() {
  const t = await getTranslations('servicesInsurance');
  const { quotes, mock } = await fetchQuotes();
  const isPreview = mock || !INSURANCE_LIVE;

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />
          <InsuranceClient initialQuotes={quotes} isPreview={isPreview} />
        </PageTransition>
      </main>
    </div>
  );
}
