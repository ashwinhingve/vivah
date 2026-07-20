import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchDayOfSnapshot } from '@/lib/wedding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { DayOfDashboard } from './DayOfDashboard.client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.dayOf' });
  return { title: t('metadata.title') };
}

export const dynamic = 'force-dynamic';

export default async function DayOfPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('weddings.dayOf');
  const { id } = await params;
  const snapshot = await fetchDayOfSnapshot(id);

  if (!snapshot) {
    return (
      <PageTransition>
        <main id="main-content" className="mx-auto max-w-3xl px-4 py-8">
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t('loadError')}
            </p>
          </div>
        </main>
      </PageTransition>
    );
  }

  return <DayOfDashboard weddingId={id} initial={snapshot} />;
}
