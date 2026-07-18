import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft, MapPinned, Store, TriangleAlert } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import type { SupplyGapReport } from '@smartshaadi/types';
import { GapThresholdFilter } from './GapThresholdFilter.client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminGaps.metadata' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

function resolveThreshold(raw: string | undefined): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0 && n <= 100) return n;
  return 3;
}

export default async function AdminGapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ threshold?: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminGaps' });

  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const sp = await searchParams;
  const threshold = resolveThreshold(sp.threshold);
  const report = await fetchAuth<SupplyGapReport>(`/api/v1/admin/vendor-gaps?threshold=${threshold}`);

  return (
    <PageTransition>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('backToAdmin')}
        </Link>

        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('heading')}
          subtitle={t('subtitle')}
          actions={<GapThresholdFilter threshold={threshold} />}
        />

        {!report ? (
          <EmptyState
            icon={TriangleAlert}
            title={t('loadError.title')}
            description={t('loadError.description')}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatsCard
                label={t('stats.underSuppliedMarkets')}
                value={report.underSuppliedCount}
                icon={TriangleAlert}
                variant={report.underSuppliedCount > 0 ? 'warning' : 'success'}
              />
              <StatsCard label={t('stats.activeCities')} value={report.citiesEvaluated} icon={MapPinned} variant="teal" />
              <StatsCard label={t('stats.cellsEvaluated')} value={report.cellsEvaluated} icon={Store} variant="gold" />
            </div>

            {report.gaps.length === 0 ? (
              <EmptyState
                icon={Store}
                title={t('noGaps.title')}
                description={t('noGaps.description', { threshold: String(threshold) })}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gold/15 text-left text-xs uppercase tracking-wide text-gold-muted">
                        <th className="px-4 py-3 font-medium">{t('table.city')}</th>
                        <th className="px-4 py-3 font-medium">{t('table.category')}</th>
                        <th className="px-4 py-3 text-right font-medium">{t('table.supply')}</th>
                        <th className="px-4 py-3 text-right font-medium">{t('table.shortfall')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/10">
                      {report.gaps.map((g) => (
                        <tr key={`${g.city}|${g.category}`} className="hover:bg-background/50">
                          <td className="px-4 py-3 font-medium text-primary">{g.city}</td>
                          <td className="px-4 py-3 text-text">{g.category}</td>
                          <td className="px-4 py-3 text-right text-text-muted">
                            {g.supply} / {g.threshold}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                              −{g.shortfall}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </PageTransition>
  );
}
