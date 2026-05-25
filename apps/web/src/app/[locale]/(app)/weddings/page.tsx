import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PlusCircle } from 'lucide-react';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingSummary } from '@smartshaadi/types';
import { StaggerList } from '@/components/shared/StaggerList.client';

async function fetchWeddings(): Promise<{ weddings: WeddingSummary[]; error: boolean }> {
  const data = await fetchAuth<{ weddings: WeddingSummary[] }>('/api/v1/weddings');
  if (data === null) return { weddings: [], error: true };
  return { weddings: data.weddings ?? [], error: false };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.list.metadata' });
  return { title: t('title') };
}

export default async function WeddingsPage() {
  const t = await getTranslations('weddings.list');
  const { weddings, error } = await fetchWeddings();

  const newWeddingCta = (
    <Link
      href="/weddings/new"
      className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-hover active:scale-[0.97] transition-all"
    >
      <PlusCircle className="h-4 w-4" aria-hidden="true" />
      {t('newWedding')}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <PageHeader
          title={t('heading')}
          subtitle={t('subtitle')}
          actions={newWeddingCta}
        />

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
            <p className="text-destructive font-medium">{t('loadError')}</p>
          </div>
        )}

        {/* Empty state */}
        {!error && weddings.length === 0 && (
          <div className="bg-surface border border-gold/20 rounded-xl shadow-card">
            <EmptyState
              variant="no-wedding"
              actionLabel={t('emptyCta')}
              actionHref="/weddings/new"
            />
          </div>
        )}

        {/* Wedding list */}
        {!error && weddings.length > 0 && (
          <StaggerList className="grid gap-4">
            {weddings.map((w) => (
              <WeddingCard key={w.id} wedding={w} />
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}
