'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import type { CampaignSend } from '@smartshaadi/types';

interface CampaignSendsTableProps {
  sends: CampaignSend[];
}

const STATUS_CLASSES: Record<string, string> = {
  QUEUED: 'bg-warning/10 text-warning border-warning/20',
  SENT: 'bg-teal-50 text-teal-700 border-teal-200',
  CONVERTED: 'bg-success/10 text-success border-success/20',
  SUPPRESSED: 'bg-surface-muted text-muted-foreground border-border',
  FAILED: 'bg-destructive/10 text-destructive border-destructive/20',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CampaignSendsTable({ sends }: CampaignSendsTableProps) {
  const t = useTranslations('adminMarketing');

  return (
    <Card padding="md">
      <div className="mb-4">
        <h3 className="font-heading text-lg font-semibold text-primary">{t('sendsTable.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('sendsTable.showing', { count: sends.length })}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left">
              <th className="py-2 pr-3 font-semibold text-muted-foreground">{t('sendsTable.status')}</th>
              <th className="py-2 pr-3 font-semibold text-muted-foreground">{t('sendsTable.channel')}</th>
              <th className="py-2 pr-3 font-semibold text-muted-foreground">{t('sendsTable.sent')}</th>
              <th className="py-2 pr-3 font-semibold text-muted-foreground">{t('sendsTable.converted')}</th>
              <th className="py-2 font-semibold text-muted-foreground">{t('sendsTable.reason')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {sends.map((send) => {
              const statusClass = STATUS_CLASSES[send.status] || 'bg-surface-muted text-muted-foreground border-border';
              return (
                <tr key={send.id} className="hover:bg-background/50 transition-colors">
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                      {send.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-foreground">
                    {send.channelSent || '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {fmtDate(send.sentAt)}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {fmtDate(send.convertedAt)}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {send.suppressedReason || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
