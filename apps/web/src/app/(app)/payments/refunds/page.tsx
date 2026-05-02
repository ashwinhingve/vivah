/**
 * Smart Shaadi — Refund History Page
 * Server Component
 */
import { cookies } from 'next/headers';
import type { RefundRecord, RefundStatus } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchRefunds(): Promise<RefundRecord[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/refunds/mine`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API envelope: { success, data: { items: [...] } }
    const json = (await res.json()) as {
      success: boolean;
      data: { items: RefundRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_MAP: Record<RefundStatus, { bg: string; text: string; label: string }> = {
  REQUESTED:  { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Requested' },
  APPROVED:   { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Approved' },
  PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Processing' },
  COMPLETED:  { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Completed' },
  FAILED:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
  REJECTED:   { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Rejected' },
};

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST:  'Customer request',
  SERVICE_CANCELLED: 'Service cancelled',
  VENDOR_NO_SHOW:    'Vendor no-show',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  DISPUTE_RESOLVED:  'Dispute resolved',
  FRAUD:             'Fraud',
  OTHER:             'Other',
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
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RefundsPage() {
  const refunds = await fetchRefunds();

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: '#FEFAF6' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#7B2D42' }}>Refund History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the status of your refund requests
          </p>
        </div>

        {refunds.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#C5A47E' }}>
            <p className="font-medium" style={{ color: '#7B2D42' }}>No refunds yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You have not submitted any refund requests.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {refunds.map(refund => {
              const badge = STATUS_MAP[refund.status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: refund.status };
              return (
                <div
                  key={refund.id}
                  className="rounded-xl bg-surface border shadow-sm p-5"
                  style={{ borderColor: '#C5A47E' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Payment {refund.paymentId.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested {formatDate(refund.requestedAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold" style={{ color: '#7B2D42' }}>
                      {formatINR(refund.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {REASON_LABELS[refund.reason] ?? refund.reason}
                    </span>
                    {refund.refundToWallet && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal/10 text-teal">
                        To wallet
                      </span>
                    )}
                  </div>

                  {refund.reasonDetails && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      &ldquo;{refund.reasonDetails}&rdquo;
                    </p>
                  )}

                  {refund.failureReason && (
                    <p className="mt-2 text-xs text-red-600">
                      Failure: {refund.failureReason}
                    </p>
                  )}

                  {refund.processedAt && (
                    <p className="mt-2 text-xs text-green-700">
                      Processed on {formatDate(refund.processedAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
