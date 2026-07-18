'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { MarketingCampaign } from '@smartshaadi/types';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface CampaignTableProps {
  campaigns: MarketingCampaign[];
  statusToneMap: Record<string, 'success' | 'info' | 'warning' | 'default'>;
}

const TONE_CLASSES: Record<'success' | 'info' | 'warning' | 'default', string> = {
  success: 'bg-success/10 text-success border-success/20',
  info: 'bg-teal-50 text-teal-700 border-teal-200',
  warning: 'bg-warning/10 text-warning border-warning/20',
  default: 'bg-surface-muted text-muted-foreground border-border',
};

export function CampaignTable({ campaigns, statusToneMap }: CampaignTableProps) {
  const t = useTranslations('adminMarketing.table');
  const tSegment = useTranslations('marketingSegments');

  return (
    <div className="overflow-x-auto rounded-2xl border border-gold-muted bg-white shadow-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-muted bg-background">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gold-muted">{t('columns.name')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gold-muted">{t('columns.trigger')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gold-muted">{t('columns.segment')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gold-muted">{t('columns.status')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gold-muted">{t('columns.created')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold-muted">
          {campaigns.map((campaign) => {
            const tone = statusToneMap[campaign.status] || 'default';
            const toneClass = TONE_CLASSES[tone];

            return (
              <tr
                key={campaign.id}
                className="hover:bg-background/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/marketing/${campaign.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {campaign.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {t(`columns.triggers.${campaign.triggerType.toLowerCase()}`)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {tSegment(`segments.${campaign.segmentKey}`)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
                    {t(`columns.statuses.${campaign.status.toLowerCase()}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                  {fmtDate(campaign.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
