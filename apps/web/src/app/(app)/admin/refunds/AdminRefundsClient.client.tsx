'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RefundRecord } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST:  'Customer request',
  SERVICE_CANCELLED: 'Service cancelled',
  VENDOR_NO_SHOW:    'Vendor no-show',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  DISPUTE_RESOLVED:  'Dispute resolved',
  FRAUD:             'Fraud',
  OTHER:             'Other',
};

const STATUS_TABS = [
  { value: 'REQUESTED',  label: 'Pending' },
  { value: 'APPROVED',   label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED',  label: 'Completed' },
  { value: 'REJECTED',   label: 'Rejected' },
  { value: 'FAILED',     label: 'Failed' },
];

interface Props {
  initialRefunds: RefundRecord[];
  initialStatus:  string;
}

interface DecideState {
  id:     string;
  action: 'approve' | 'reject';
  notes:  string;
}

export function AdminRefundsClient({ initialRefunds, initialStatus }: Props) {
  const router  = useRouter();
  const [refunds, setRefunds]    = useState<RefundRecord[]>(initialRefunds);
  const [status,  setStatus]     = useState(initialStatus);
  const [decide,  setDecide]     = useState<DecideState | null>(null);
  const [acting,  setActing]     = useState(false);
  const [errors,  setErrors]     = useState<Record<string, string>>({});

  function switchStatus(s: string) {
    setStatus(s);
    router.push(`/admin/refunds?status=${s}`);
  }

  async function submitDecision() {
    if (!decide) return;
    setActing(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/refunds/admin/decide`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundId: decide.id,
          decision: decide.action === 'approve' ? 'APPROVED' : 'REJECTED',
          notes:    decide.notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: RefundRecord; error?: string };
      if (!res.ok || !json.success) {
        setErrors(prev => ({ ...prev, [decide.id]: json.error ?? 'Failed to process decision.' }));
      } else {
        setRefunds(prev => prev.filter(r => r.id !== decide.id));
      }
      setDecide(null);
    } catch {
      setErrors(prev => ({ ...prev, [decide.id]: 'Network error.' }));
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Refund Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and act on customer refund requests</p>
        </div>

        {/* Status tabs */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => switchStatus(tab.value)}
              className={[
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors',
                status === tab.value
                  ? 'border-transparent text-white'
                  : 'border-[#C5A47E] text-muted-foreground hover:text-foreground bg-transparent',
              ].join(' ')}
              style={status === tab.value ? { background: '#7B2D42' } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {refunds.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center border-gold">
            <p className="font-medium text-primary">No refunds in this queue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === 'REQUESTED' ? 'All pending refunds have been processed.' : 'No refunds with this status.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {refunds.map(refund => {
              const err    = errors[refund.id];
              const isOpen = decide?.id === refund.id;
              return (
                <div
                  key={refund.id}
                  className="rounded-xl bg-surface border shadow-sm p-5 border-gold"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Payment {refund.paymentId.slice(0, 12)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested {formatDate(refund.requestedAt)} · {REASON_LABELS[refund.reason] ?? refund.reason}
                      </p>
                      {refund.reasonDetails && (
                        <p className="mt-1 text-xs text-muted-foreground italic max-w-md">
                          &ldquo;{refund.reasonDetails}&rdquo;
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xl font-bold text-primary">
                      {formatINR(refund.amount)}
                    </p>
                  </div>

                  {refund.refundToWallet && (
                    <p className="mt-2 text-xs text-teal font-medium">Customer requested wallet credit</p>
                  )}

                  {err && (
                    <p className="mt-2 text-xs text-destructive">{err}</p>
                  )}

                  {status === 'REQUESTED' && (
                    <>
                      {/* Inline notes + decision */}
                      {isOpen ? (
                        <div className="mt-4 space-y-3">
                          <textarea
                            rows={2}
                            value={decide.notes}
                            onChange={e => setDecide(prev => prev ? { ...prev, notes: e.target.value } : null)}
                            placeholder="Add a note for the customer (optional)…"
                            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={submitDecision}
                              disabled={acting}
                              className="text-xs"
                            >
                              {acting ? 'Processing…' : decide.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
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
                            onClick={() => setDecide({ id: refund.id, action: 'approve', notes: '' })}
                            className="text-xs"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDecide({ id: refund.id, action: 'reject', notes: '' })}
                            className="text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </>
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
