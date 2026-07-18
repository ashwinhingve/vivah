'use client';

import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';
import type { MarketingOverviewStats, MarketingCampaign } from '@smartshaadi/types';
import { CampaignTable } from './CampaignTable.client';

interface MarketingOverviewProps {
  stats?: MarketingOverviewStats;
  campaigns: MarketingCampaign[];
}

const STATUS_TONE_MAP: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  DRAFT: 'default',
  APPROVED: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'default',
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card padding="md">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-primary">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function MarketingOverview({ stats, campaigns }: MarketingOverviewProps) {
  const t = useTranslations('adminMarketing');

  const conversionRate = stats?.conversionRate30d ?? 0;
  const formattedRate = (conversionRate * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t('stats.activeCampaigns')}
          value={String(stats?.campaignsActive ?? 0)}
        />
        <StatTile
          label={t('stats.draftCampaigns')}
          value={String(stats?.campaignsDraft ?? 0)}
        />
        <StatTile
          label={t('stats.sentLast30d')}
          value={String(stats?.sentLast30d ?? 0)}
        />
        <StatTile
          label={t('stats.conversionRate')}
          value={`${formattedRate}%`}
        />
      </div>

      {/* Campaigns Table */}
      {campaigns.length === 0 ? (
        <Card padding="md">
          <p className="rounded-lg bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
            {t('empty.title')}
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              href="/admin/marketing/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" />
              {t('actions.createCampaign')}
            </Link>
          </div>
        </Card>
      ) : (
        <Card padding="md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold text-primary">{t('table.title')}</h3>
            <Link
              href="/admin/marketing/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" />
              {t('actions.new')}
            </Link>
          </div>
          <CampaignTable campaigns={campaigns} statusToneMap={STATUS_TONE_MAP} />
        </Card>
      )}
    </div>
  );
}
