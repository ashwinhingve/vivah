'use client';

import { StatCard } from '@/components/ui/StatCard';
import type { Overview } from './types';

const inr = (n: number): string =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
const oneDp = (n: number): string => n.toFixed(1);

export function OverviewCards({ data }: { data: Overview | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/30 bg-surface px-6 py-10 text-center text-sm text-text-muted">
        Overview metrics are unavailable right now.
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Users"
        value={data.totalUsers.value}
        trendPct={data.totalUsers.changePct ?? undefined}
      />
      <StatCard
        label="Active Matches"
        value={data.activeMatches.value}
        trendPct={data.activeMatches.changePct ?? undefined}
      />
      <StatCard
        label="Revenue MTD"
        value={data.revenueMtd.value}
        staticValue={inr(data.revenueMtd.value)}
        trendPct={data.revenueMtd.changePct ?? undefined}
      />
      <StatCard
        label="Avg Compatibility"
        value={data.avgCompatScore.value}
        staticValue={oneDp(data.avgCompatScore.value)}
        trendPct={data.avgCompatScore.changePct ?? undefined}
      />
    </div>
  );
}
