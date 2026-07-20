import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { ReconciliationTableClient } from './ReconciliationTableClient.client';

interface AuthMe { userId: string; role: string; status: string }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRole' });
  return { title: `${t('navTiles.reconciliation.label')} — Admin | Smart Shaadi` };
}

interface Discrepancy {
  id: string;
  paymentId: string | null;
  razorpayPaymentId: string | null;
  field: string;
  expected: string | null;
  actual: string | null;
  status: string;
  notes: string | null;
  detectedAt: string;
}

async function fetchDiscrepancies(): Promise<Discrepancy[]> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  try {
    const res = await fetch(`${apiBase}/api/v1/payments/admin/reconciliation`, {
      cache: 'no-store',
      headers: { cookie },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { items?: Discrepancy[] } };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  const t = await getTranslations('adminRole');
  // Defense-in-depth: middleware fail-opens if /api/auth/me errors, so re-check
  // the role here and redirect any non-admin off the page.
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }
  const items = await fetchDiscrepancies();
  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.adminConsole')}
        </Link>

        <FadeUp>
          <PageHeader
            title={t('reconciliation.title')}
            subtitle={t('reconciliation.subtitle')}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('reconciliation.breadcrumb') }]}
          />
        </FadeUp>

        <FadeUp>
          <ReconciliationTableClient items={items} />
        </FadeUp>
      </main>
    </PageTransition>
  );
}
