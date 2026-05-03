'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RefundRecord } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { Container, EmptyState, PageHeader } from '@/components/shared';
import { cn } from '@/lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: 'Customer request',
  SERVICE_CANCELLED: 'Service cancelled',
  VENDOR_NO_SHOW: 'Vendor no-show',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  DISPUTE_RESOLVED: 'Dispute resolved',
  FRAUD: 'Fraud',
  OTHER: 'Other',
};

const STATUS_TABS = [
  { value: 'REQUESTED', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'FAILED', label: 'Failed' },
];

interface Props {
  initialRefunds: RefundRecord[];
  initialStatus: string;
}

interface DecideState {
  id: string;
  action: 'approve' | 'reject';
  notes: string;
}

export function AdminRefundsClient({ initialRefunds, initialStatus }: Props) {
  const router = useRouter();
  const [refunds, setRefunds] = useState<RefundRecord[]>(initialRefunds);
  const [status, setStatus] = useState(initialStatus);
  const [decide, setDecide] = useState<DecideState | null>(null);
  const [acting, setActing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function switchStatus(s: string) {
    setStatus(s);
    router.push(`/admin/refunds?status=${s}`);
  }

  async function submitDecision() {
    if (!decide) return;
    setActing(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/refunds/admin/decide`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundId: decide.id,
          decision: decide.action === 'approve' ? 'APPROVED' : 'REJECTED',
          notes: decide.notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: RefundRecord; error?: string };
      if (!res.ok || !json.success) {
        setErrors((prev) => ({ ...prev, [decide.id]: json.error ?? 'Failed to process decision.' }));
      } else {
        setRefunds((prev) => prev.filter((r) => r.id !== decide.id));
      }
      setDecide(null);
    } catch {
      setErrors((prev) => ({ ...prev, [decide.id]: 'Network error.' }));
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="default">
        <PageHeader
          title="Refund Queue"
          subtitle="Review and act on customer refund requests"
        />

        <div
          role="tablist"
          aria-label="Refund status filter"
          className="mb-5 flex gap-1.5 overflow-x-auto pb-1"
        >
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchStatus(tab.value)}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-gold bg-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {refunds.length === 0 ? (
          <EmptyState
            title="No refunds in this queue"
            description={
              status === 'REQUESTED'
                ? 'All pending refunds have been processed.'
                : 'No refunds with this status.'
            }
          />
        ) : (
          <ul className="space-y-4">
            {refunds.map((refund) => {
              const err = errors[refund.id];
              const isOpen = decide?.id === refund.id;
              return (
                <li
                  key={refund.id}
                  className="rounded-xl border border-gold bg-surface p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        Payment {refund.paymentId.slice(0, 12)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested {formatDate(refund.requestedAt)} ·{' '}
                        {REASON_LABELS[refund.reason] ?? refund.reason}
                      </p>
                      {refund.reasonDetails ? (
                        <p className="mt-1 max-w-md text-xs italic text-muted-foreground">
                          &ldquo;{refund.reasonDetails}&rdquo;
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xl font-bold text-primary">
                      {formatINR(refund.amount)}
                    </p>
                  </div>

                  {refund.refundToWallet ? (
                    <p className="mt-2 text-xs font-medium text-teal">
                      Customer requested wallet credit
                    </p>
                  ) : null}

                  {err ? (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                      {err}
                    </p>
                  ) : null}

                  {status === 'REQUESTED' ? (
                    <>
                      {isOpen ? (
                        <div className="mt-4 space-y-3">
                          <textarea
                            rows={2}
                            value={decide.notes}
                            onChange={(e) =>
                              setDecide((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                            }
                            placeholder="Add a note for the customer (optional)…"
                            className="w-full resize-none rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={submitDecision}
                              disabled={acting}
                              className="text-xs"
                            >
                              {acting
                                ? 'Processing…'
                                : decide.action === 'approve'
                                  ? 'Confirm Approval'
                                  : 'Confirm Rejection'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDecide(null)}
                              disabled={acting}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setDecide({ id: refund.id, action: 'approve', notes: '' })
                            }
                            className="text-xs"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setDecide({ id: refund.id, action: 'reject', notes: '' })
                            }
                            className="text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </>
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
