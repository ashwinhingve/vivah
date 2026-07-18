'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import type { RetentionCampaign, RetentionStats, RetentionStatus } from '@smartshaadi/types';

interface Props {
  stats:     RetentionStats | null;
  campaigns: RetentionCampaign[];
}

const STATUS_TONE: Record<RetentionStatus, string> = {
  DRY_RUN:    'bg-gold/15 text-gold-muted',
  QUEUED:     'bg-teal/10 text-teal',
  SENT:       'bg-teal/15 text-teal',
  CONVERTED:  'bg-success/10 text-success',
  EXPIRED:    'bg-surface-muted text-muted-foreground',
  SUPPRESSED: 'bg-surface-muted text-muted-foreground',
};

const BAND_TONE: Record<string, string> = {
  low:      'text-muted-foreground',
  medium:   'text-warning',
  high:     'text-warning',
  critical: 'text-destructive',
};

function fmtDate(iso: string | null, t: (key: string) => string): string {
  if (!iso) return t('noDate');
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card padding="md">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-primary">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function RetentionOverview({ stats, campaigns }: Props) {
  const t = useTranslations('adminRetention');
  const dryRun = stats?.byStatus.DRY_RUN ?? 0;
  const sent   = stats?.byStatus.SENT ?? 0;
  const converted = stats?.byStatus.CONVERTED ?? 0;
  const conversionPct = stats ? Math.round(stats.conversionRate * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('totalAttempts')} value={String(stats?.total ?? 0)} />
        <StatTile label={t('dryRun')} value={String(dryRun)} hint={t('dryRunHint')} />
        <StatTile label={t('sent')} value={String(sent)} />
        <StatTile label={t('conversionRate')} value={`${conversionPct}%`} hint={t('conversionHint', { count: converted })} />
      </div>

      {/* Campaign table */}
      <Card padding="md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-primary">{t('recoveryAttempts')}</h3>
          <span className="text-xs text-muted-foreground">{t('showingCount', { count: campaigns.length })}</span>
        </div>

        {campaigns.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
            {t('noAttempts')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gold/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">{t('tableHeaderUser')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('tableHeaderRisk')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('tableHeaderAction')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('tableHeaderStatus')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('tableHeaderCreated')}</th>
                  <th className="py-2 font-semibold">{t('tableHeaderConverted')}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gold/10 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-xs text-foreground">{c.userId.slice(0, 8)}…</td>
                    <td className={`py-2.5 pr-3 font-semibold ${BAND_TONE[c.riskBand] ?? ''}`}>
                      {c.riskBand} <span className="text-muted-foreground">({Math.round(c.churnProbability * 100)}%)</span>
                    </td>
                    <td className="py-2.5 pr-3 text-foreground">{c.actionType.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{fmtDate(c.createdAt, t)}</td>
                    <td className="py-2.5 text-muted-foreground">{fmtDate(c.convertedAt, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
