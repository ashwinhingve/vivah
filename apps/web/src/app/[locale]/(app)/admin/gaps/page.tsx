import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft, MapPinned, Store, TriangleAlert } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SupplyGapReport } from '@smartshaadi/types';
import { GapThresholdFilter } from './GapThresholdFilter.client';

export const metadata: Metadata = { title: 'Vendor Gaps · Admin' };
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
  searchParams,
}: {
  searchParams: Promise<{ threshold?: string }>;
}) {
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const sp = await searchParams;
  const threshold = resolveThreshold(sp.threshold);
  const report = await fetchAuth<SupplyGapReport>(`/api/v1/admin/vendor-gaps?threshold=${threshold}`);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to admin
      </Link>

      <PageHeader
        eyebrow="Admin"
        title="Vendor Supply Gaps"
        subtitle="Under-supplied (city × category) markets to prioritise for vendor recruiting."
        actions={<GapThresholdFilter threshold={threshold} />}
      />

      {!report ? (
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load supply gaps"
          description="The gap report is unavailable right now. Try again shortly."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard
              label="Under-supplied markets"
              value={report.underSuppliedCount}
              icon={TriangleAlert}
              variant={report.underSuppliedCount > 0 ? 'warning' : 'success'}
            />
            <StatsCard label="Active cities" value={report.citiesEvaluated} icon={MapPinned} variant="teal" />
            <StatsCard label="Cells evaluated" value={report.cellsEvaluated} icon={Store} variant="gold" />
          </div>

          {report.gaps.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No gaps at this threshold"
              description={`Every active market has at least ${threshold} vendors per category. Lower the threshold to probe deeper.`}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold/15 text-left text-xs uppercase tracking-wide text-gold-muted">
                      <th className="px-4 py-3 font-medium">City</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 text-right font-medium">Supply</th>
                      <th className="px-4 py-3 text-right font-medium">Shortfall</th>
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
  );
}
