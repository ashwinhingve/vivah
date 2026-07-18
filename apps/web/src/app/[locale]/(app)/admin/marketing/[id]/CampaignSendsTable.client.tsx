'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import type { CampaignSend } from '@smartshaadi/types';

interface CampaignSendsTableProps {
  sends: CampaignSend[];
}

const STATUS_CLASSES: Record<string, string> = {
  QUEUED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  SENT: 'bg-teal-50 text-teal-700 border-teal-200',
  CONVERTED: 'bg-green-50 text-green-700 border-green-200',
  SUPPRESSED: 'bg-gray-50 text-gray-700 border-gray-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
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
              const statusClass = STATUS_CLASSES[send.status] || 'bg-gray-50 text-gray-700 border-gray-200';
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
