import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompatibilityDisclaimer } from '@/components/dpi/CompatibilityDisclaimer';
import { CompatibilityGauge } from '@/components/dpi/CompatibilityGauge.client';
import { FiiDetailPanel } from '@/components/fii/FiiDetailPanel.client';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'compatibility.metadata' });
  return { title: t('title') };
}

function GaugeSkeleton() {
  return (
    <div className="text-center" aria-busy="true">
      <div className="mx-auto h-[140px] w-full max-w-[280px] rounded-t-full bg-muted/40 animate-pulse" />
      <p className="mt-4 text-sm text-muted-foreground">Analysing compatibility patterns…</p>
    </div>
  );
}

export default async function CompatibilityPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('compatibility');

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <CompatibilityDisclaimer />

        <PageHeader
          title={t('heading')}
          subtitle="A thoughtful look at your match based on profile patterns."
          className="mb-6"
        />

        <Suspense fallback={<GaugeSkeleton />}>
          <CompatibilityGauge matchId={id} />
        </Suspense>

        <FiiDetailPanel matchId={id} />
      </div>
    </main>
  );
}
