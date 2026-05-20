import { redirect } from 'next/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/motion/StaggerList.client';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { OverviewCards } from '@/components/analytics/OverviewCards.client';
import { SignupsChart } from '@/components/analytics/SignupsChart.client';
import { MatchActivityChart } from '@/components/analytics/MatchActivityChart.client';
import { StayQuotientChart } from '@/components/analytics/StayQuotientChart.client';
import { RevenueChart } from '@/components/analytics/RevenueChart.client';
import { TopMatchesTable } from '@/components/analytics/TopMatchesTable.client';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter.client';
import { ExportButton } from '@/components/analytics/ExportButton.client';
import type {
  Overview,
  SignupPoint,
  MatchWeek,
  StayBucket,
  RevenueMonth,
  TopMatch,
} from '@/components/analytics/types';

interface AuthMe {
  id: string;
  role: string;
  status: string;
}

interface SearchParams {
  range?: string;
  from?: string;
  to?: string;
}

function resolveDays(sp: SearchParams): number {
  const r = sp.range ?? '30';
  if (r === '7' || r === '30' || r === '90') return Number(r);
  if (r === 'custom' && sp.from && sp.to) {
    const ms = Date.parse(`${sp.to}T00:00:00Z`) - Date.parse(`${sp.from}T00:00:00Z`);
    const d = Math.round(ms / 86_400_000) + 1;
    if (Number.isFinite(d) && d > 0) return Math.min(90, Math.max(7, d));
  }
  return 30;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const sp = await searchParams;
  const days = resolveDays(sp);
  const weeks = Math.min(12, Math.max(1, Math.ceil(days / 7)));
  const months = Math.min(12, Math.max(3, Math.round(days / 30) + 5));

  const [overview, signups, matches, stay, revenue, topMatches] = await Promise.all([
    fetchAuth<Overview>('/api/v1/admin/analytics/overview'),
    fetchAuth<{ data: SignupPoint[] }>(`/api/v1/admin/analytics/signups?days=${days}`),
    fetchAuth<{ data: MatchWeek[] }>(`/api/v1/admin/analytics/matches?weeks=${weeks}`),
    fetchAuth<{ data: StayBucket[] }>('/api/v1/admin/analytics/stay-quotient'),
    fetchAuth<{ data: RevenueMonth[] }>(`/api/v1/admin/analytics/revenue?months=${months}`),
    fetchAuth<{ data: TopMatch[] }>('/api/v1/admin/analytics/top-matches'),
  ]);

  const signupData = signups?.data ?? null;
  const matchData = matches?.data ?? null;

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Platform growth, engagement &amp; revenue trends
            </p>
          </div>
          <ExportButton overview={overview} signups={signupData} matches={matchData} />
        </div>

        <div className="mb-6">
          <DateRangeFilter />
        </div>

        <StaggerList className="space-y-8">
          <section>
            <SectionHeader title="Platform Overview" subtitle="Key metrics vs. last month" />
            <OverviewCards data={overview} />
          </section>

          <section>
            <SectionHeader title="User Growth" subtitle={`New signups · last ${days} days`} />
            <SignupsChart data={signupData} />
          </section>

          <section>
            <SectionHeader
              title="Match Activity"
              subtitle={`Interests sent vs. accepted · last ${weeks} weeks`}
            />
            <MatchActivityChart data={matchData} />
          </section>

          <section>
            <SectionHeader
              title="Engagement Risk"
              subtitle="Activity-based proxy for retention risk"
            />
            <StayQuotientChart data={stay?.data ?? null} />
          </section>

          <section>
            <SectionHeader
              title="Revenue Breakdown"
              subtitle={`Subscription revenue by plan · last ${months} months`}
            />
            <RevenueChart data={revenue?.data ?? null} />
          </section>

          <section>
            <SectionHeader
              title="Top Compatibility Matches"
              subtitle="Highest-scoring pairs (match_scores)"
            />
            <TopMatchesTable data={topMatches?.data ?? null} />
          </section>
        </StaggerList>
      </main>
    </PageTransition>
  );
}
