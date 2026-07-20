/**
 * Smart Shaadi — Refund History Page
 * Server Component
 */
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { RefundRecord, RefundStatus } from '@smartshaadi/types';
import { Container } from '@/components/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchRefunds(): Promise<RefundRecord[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/refunds/mine`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { items: RefundRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

const STATUS_TONE_MAP: Record<RefundStatus, StatusTone> = {
  REQUESTED: 'warning',
  APPROVED: 'teal',
  PROCESSING: 'primary',
  COMPLETED: 'success',
  FAILED: 'error',
  REJECTED: 'neutral',
};

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default async function RefundsPage() {
  const t = await getTranslations('payments.refunds');
  const refunds = await fetchRefunds();

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />

        {refunds.length === 0 ? (
          <EmptyState
            title={t('noRefunds')}
            description={t('noRefundsDesc')}
          />
        ) : (
          <ul className="space-y-4">
            {refunds.map((refund) => {
              const tone = STATUS_TONE_MAP[refund.status] ?? 'neutral';
              return (
                <li
                  key={refund.id}
                  className="rounded-2xl border border-gold bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {t('paymentPrefix')} {refund.paymentId.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('requestedOn')} {formatDate(refund.requestedAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-primary">
                      {formatINR(refund.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip tone={tone}>
                      {t(`status.${refund.status}`)}
                    </StatusChip>
                    <span className="text-xs text-muted-foreground">
                      {t(`reason.${refund.reason}`)}
                    </span>
                    {refund.refundToWallet ? (
                      <StatusChip tone="teal">
                        {t('toWallet')}
                      </StatusChip>
                    ) : null}
                  </div>

                  {refund.reasonDetails ? (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      &ldquo;{refund.reasonDetails}&rdquo;
                    </p>
                  ) : null}

                  {refund.failureReason ? (
                    <p className="mt-2 text-xs text-destructive">
                      {t('failurePrefix')}: {refund.failureReason}
                    </p>
                  ) : null}

                  {refund.processedAt ? (
                    <p className="mt-2 text-xs text-success">
                      {t('processedOn')} {formatDate(refund.processedAt)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </main>
  );
}
