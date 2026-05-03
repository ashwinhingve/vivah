/**
 * Smart Shaadi — Refund History Page
 * Server Component
 */
import { cookies } from 'next/headers';
import type { RefundRecord, RefundStatus } from '@smartshaadi/types';
import { Container, EmptyState, PageHeader } from '@/components/shared';

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

const STATUS_MAP: Record<RefundStatus, { className: string; label: string }> = {
  REQUESTED: { className: 'bg-warning/15 text-warning', label: 'Requested' },
  APPROVED: { className: 'bg-teal/10 text-teal', label: 'Approved' },
  PROCESSING: { className: 'bg-primary/15 text-primary', label: 'Processing' },
  COMPLETED: { className: 'bg-success/15 text-success', label: 'Completed' },
  FAILED: { className: 'bg-destructive/15 text-destructive', label: 'Failed' },
  REJECTED: { className: 'bg-secondary text-muted-foreground', label: 'Rejected' },
};

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: 'Customer request',
  SERVICE_CANCELLED: 'Service cancelled',
  VENDOR_NO_SHOW: 'Vendor no-show',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  DISPUTE_RESOLVED: 'Dispute resolved',
  FRAUD: 'Fraud',
  OTHER: 'Other',
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
  const refunds = await fetchRefunds();

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader title="Refund History" subtitle="Track the status of your refund requests" />

        {refunds.length === 0 ? (
          <EmptyState
            title="No refunds yet"
            description="You have not submitted any refund requests."
          />
        ) : (
          <ul className="space-y-4">
            {refunds.map((refund) => {
              const badge =
                STATUS_MAP[refund.status] ?? {
                  className: 'bg-secondary text-muted-foreground',
                  label: refund.status,
                };
              return (
                <li
                  key={refund.id}
                  className="rounded-xl border border-gold bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        Payment {refund.paymentId.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested {formatDate(refund.requestedAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-primary">
                      {formatINR(refund.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {REASON_LABELS[refund.reason] ?? refund.reason}
                    </span>
                    {refund.refundToWallet ? (
                      <span className="inline-flex items-center rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
                        To wallet
                      </span>
                    ) : null}
                  </div>

                  {refund.reasonDetails ? (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      &ldquo;{refund.reasonDetails}&rdquo;
                    </p>
                  ) : null}

                  {refund.failureReason ? (
                    <p className="mt-2 text-xs text-destructive">
                      Failure: {refund.failureReason}
                    </p>
                  ) : null}

                  {refund.processedAt ? (
                    <p className="mt-2 text-xs text-success">
                      Processed on {formatDate(refund.processedAt)}
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
