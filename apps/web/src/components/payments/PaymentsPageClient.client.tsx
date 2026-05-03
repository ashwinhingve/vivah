'use client';

import { useState } from 'react';
import Link from 'next/link';
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

const STATUS_TABS: { value: PaymentStatus; label: string }[] = [
  { value: 'ALL',      label: 'All' },
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED',   label: 'Failed' },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:            { bg: 'bg-warning/15',  text: 'text-warning',  label: 'Pending' },
  CAPTURED:           { bg: 'bg-teal/10',    text: 'text-teal',       label: 'Captured' },
  RELEASED:           { bg: 'bg-success/15',  text: 'text-success',  label: 'Released' },
  REFUNDED:           { bg: 'bg-secondary',  text: 'text-muted-foreground',  label: 'Refunded' },
  FAILED:             { bg: 'bg-destructive/15',    text: 'text-destructive',    label: 'Failed' },
  PARTIALLY_REFUNDED: { bg: 'bg-warning/15', text: 'text-warning', label: 'Partly Refunded' },
};

export function PaymentsPageClient({ payments }: Props) {
  const [filter,           setFilter]           = useState<PaymentStatus>('ALL');
  const [refundTarget,     setRefundTarget]      = useState<PaymentItem | null>(null);
  const [showStatement,    setShowStatement]     = useState(false);
  const [refundSuccess,    setRefundSuccess]     = useState(false);

  const filtered = filter === 'ALL'
    ? payments
    : payments.filter(p => p.status === filter);

  return (
    <>
      {/* Statement download button */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowStatement(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gold/10"
          style={{ borderColor: '#C5A47E', color: '#7B2D42' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Download Statement
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border p-1" style={{ borderColor: '#C5A47E', background: '#FEF9F0' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={[
              'flex-1 min-w-[72px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap',
              filter === tab.value
                ? 'bg-surface shadow-sm text-[#7B2D42]'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {refundSuccess && (
        <div className="mb-4 rounded-lg bg-success/10 border border-success/30 px-4 py-3 text-sm text-success">
          Refund request submitted successfully. You will be notified once it is reviewed.
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#C5A47E' }}>
          <p className="font-medium" style={{ color: '#7B2D42' }}>No payments found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === 'ALL' ? 'You have no payment records yet.' : `No ${filter.toLowerCase()} payments.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(payment => {
            const badge = STATUS_BADGE[payment.status] ?? { bg: 'bg-secondary', text: 'text-muted-foreground', label: payment.status };
            return (
              <div
                key={payment.id}
                className="rounded-xl bg-surface shadow-sm border p-5"
                style={{ borderColor: '#C5A47E' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {payment.razorpayOrderId || `Booking ${payment.bookingId.slice(0, 8)}…`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-bold" style={{ color: '#7B2D42' }}>
                    {formatINR(payment.amount)}
                  </p>
                </div>

                {/* Status badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  {payment.escrow && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal/10 text-teal">
                      Escrow {payment.escrow.status.toLowerCase()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {payment.invoiceId && (
                    <Link
                      href={`/payments/invoices/${payment.invoiceId}`}
                      className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gold/10"
                      style={{ borderColor: '#C5A47E', color: '#7B2D42' }}
                    >
                      View Invoice
                    </Link>
                  )}
                  {(payment.status === 'CAPTURED' || payment.status === 'RELEASED') && (
                    <button
                      type="button"
                      onClick={() => setRefundTarget(payment)}
                      className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 transition-colors"
                    >
                      Request Refund
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
