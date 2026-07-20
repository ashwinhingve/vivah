'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { RefundRequestModal } from './RefundRequestModal.client';
import { StatementDownloadModal } from './StatementDownloadModal.client';

type PaymentStatus = 'ALL' | 'CAPTURED' | 'REFUNDED' | 'FAILED';

interface PaymentItem {
  id:                string;
  bookingId:         string;
  amount:            string;
  currency:          string;
  status:            string;
  razorpayOrderId:   string;
  razorpayPaymentId: string | null;
  createdAt:         string;
  invoiceId:         string | null;
  escrow: {
    id:           string;
    status:       'HELD' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';
    totalHeld:    string;
    released:     string;
    releaseDueAt: string | null;
    releasedAt:   string | null;
  } | null;
}

interface Props {
  payments: PaymentItem[];
}

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
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  PENDING:            'warning',
  CAPTURED:           'teal',
  RELEASED:           'success',
  REFUNDED:           'neutral',
  FAILED:             'error',
  PARTIALLY_REFUNDED: 'warning',
};

export function PaymentsPageClient({ payments }: Props) {
  const t = useTranslations('payments');
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<PaymentStatus>('ALL');
  const [refundTarget, setRefundTarget] = useState<PaymentItem | null>(null);
  const [showStatement, setShowStatement] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = filter === 'ALL'
    ? payments
    : payments.filter(p => p.status === filter);

  const STATUS_TABS: { value: PaymentStatus; label: string }[] = [
    { value: 'ALL', label: t('tabs.all') },
    { value: 'CAPTURED', label: t('tabs.captured') },
    { value: 'REFUNDED', label: t('tabs.refunded') },
    { value: 'FAILED', label: t('tabs.failed') },
  ];

  return (
    <>
      {/* Statement download button */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowStatement(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold px-4 py-2 text-sm font-medium transition-colors hover:bg-gold/10 text-primary min-h-[44px]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          {t('downloadStatement')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-gold p-1 bg-secondary">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={[
              'flex-1 min-w-[72px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap',
              filter === tab.value
                ? 'bg-surface shadow-card text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {refundSuccess && (
        <div className="mb-4 rounded-lg bg-success/10 border border-success/30 px-4 py-3 text-sm text-success">
          {t('refundSubmitted')}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gold border-dashed py-16 text-center bg-surface">
          <p className="font-medium text-primary">{t('noPayments')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === 'ALL' ? t('noPaymentsDesc') : t('noPaymentsFilterDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(payment => {
            const tone = STATUS_TONE_MAP[payment.status] ?? 'neutral';
            return (
              <div
                key={payment.id}
                className="rounded-2xl bg-surface shadow-card border border-gold p-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {payment.razorpayOrderId || `${t('booking')} ${payment.bookingId.slice(0, 8)}…`}
                    </p>
                    {mounted && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-lg font-bold text-primary">
                    {formatINR(payment.amount)}
                  </p>
                </div>

                {/* Status badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusChip tone={tone}>
                    {t(`status.${payment.status}`)}
                  </StatusChip>
                  {payment.escrow && (
                    <StatusChip tone="teal">
                      {t(`escrow.${payment.escrow.status}`)}
                    </StatusChip>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {payment.invoiceId && (
                    <Link
                      href={`/payments/invoices/${payment.invoiceId}`}
                      className="inline-flex items-center rounded-lg border border-gold px-3 py-2 text-xs font-medium transition-colors hover:bg-gold/10 text-primary min-h-[44px]"
                    >
                      {t('viewInvoice')}
                    </Link>
                  )}
                  {(payment.status === 'CAPTURED' || payment.status === 'RELEASED') && (
                    <button
                      type="button"
                      onClick={() => setRefundTarget(payment)}
                      className="inline-flex items-center rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
                    >
                      {t('requestRefund')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {refundTarget && (
        <RefundRequestModal
          paymentId={refundTarget.id}
          maxAmount={parseFloat(refundTarget.amount)}
          onClose={() => setRefundTarget(null)}
          onSuccess={() => {
            setRefundTarget(null);
            setRefundSuccess(true);
          }}
        />
      )}
      {showStatement && (
        <StatementDownloadModal onClose={() => setShowStatement(false)} />
      )}
    </>
  );
}
