'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TABS: { value: PayoutStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',        label: 'All' },
  { value: 'SCHEDULED',  label: 'Scheduled' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED',  label: 'Completed' },
  { value: 'FAILED',     label: 'Failed' },
  { value: 'ON_HOLD',    label: 'On Hold' },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  SCHEDULED:  { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Scheduled' },
  PROCESSING: { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Processing' },
  COMPLETED:  { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Completed' },
  FAILED:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
  ON_HOLD:    { bg: 'bg-orange-100', text: 'text-orange-700', label: 'On Hold' },
};

interface Props {
  initialPayouts: PayoutRecord[];
  initialStatus:  PayoutStatus | 'ALL';
}

export function AdminPayoutsClient({ initialPayouts, initialStatus }: Props) {
  const router = useRouter();
  const [payouts,   setPayouts]   = useState<PayoutRecord[]>(initialPayouts);
  const [filter,    setFilter]    = useState<PayoutStatus | 'ALL'>(initialStatus);
  const [actingId,  setActingId]  = useState<string | null>(null);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  function switchFilter(status: PayoutStatus | 'ALL') {
    setFilter(status);
    const qs = status !== 'ALL' ? `?status=${status}` : '';
    router.push(`/admin/payouts${qs}`);
  }

  const displayed = filter === 'ALL' ? payouts : payouts.filter(p => p.status === filter);

  async function processNow(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/payouts/admin/${id}/process`, {
        method: 'POST', credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; data?: PayoutRecord; error?: string };
      if (!res.ok || !json.success) {
        setErrors(prev => ({ ...prev, [id]: json.error ?? 'Failed to process payout.' }));
        return;
      }
      if (json.data) {
        setPayouts(prev => prev.map(p => p.id === id ? json.data! : p));
      }
    } catch {
      setErrors(prev => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setActingId(null);
    }
  }

  async function retryPayout(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/payouts/admin/${id}/retry`, {
        method: 'POST', credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; data?: PayoutRecord; error?: string };
      if (!res.ok || !json.success) {
        setErrors(prev => ({ ...prev, [id]: json.error ?? 'Failed to retry payout.' }));
        return;
      }
      if (json.data) {
        setPayouts(prev => prev.map(p => p.id === id ? json.data! : p));
      }
    } catch {
      setErrors(prev => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: '#FEFAF6' }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#7B2D42' }}>Vendor Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage and process vendor payout disbursements</p>
        </div>

        {/* Status filter chips */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => switchFilter(tab.value)}
              className={[
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors',
                filter === tab.value
                  ? 'border-transparent text-white'
                  : 'border-[#C5A47E] text-muted-foreground hover:text-foreground bg-transparent',
              ].join(' ')}
              style={filter === tab.value ? { background: '#7B2D42' } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#C5A47E' }}>
            <p className="font-medium" style={{ color: '#7B2D42' }}>No payouts found</p>
            <p className="mt-1 text-sm text-muted-foreground">No payouts match the current filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(payout => {
              const badge = STATUS_BADGE[payout.status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: payout.status };
              const err   = errors[payout.id];
              const busy  = actingId === payout.id;
              return (
                <div
                  key={payout.id}
                  className="rounded-xl bg-surface border shadow-sm p-5"
                  style={{ borderColor: '#C5A47E' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        Vendor {payout.vendorId.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Scheduled: {formatDate(payout.scheduledFor)} · Processed: {formatDate(payout.processedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color: '#7B2D42' }}>{formatINR(payout.netAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Gross {formatINR(payout.grossAmount)} − Fee {formatINR(payout.platformFee)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {payout.attempts > 1 && (
                      <span className="text-xs text-muted-foreground">Attempt {payout.attempts}</span>
                    )}
                  </div>

                  {payout.failureReason && (
                    <p className="mt-2 text-xs text-red-600">Reason: {payout.failureReason}</p>
                  )}

                  {err && (
                    <p className="mt-2 text-xs text-red-600">{err}</p>
                  )}

                  <div className="mt-3 flex gap-2">
                    {(payout.status === 'SCHEDULED' || payout.status === 'ON_HOLD') && (
                      <Button
                        size="sm"
                        onClick={() => processNow(payout.id)}
                        disabled={busy}
                        className="text-xs"
                      >
                        {busy ? 'Processing…' : 'Process Now'}
                      </Button>
                    )}
                    {payout.status === 'FAILED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryPayout(payout.id)}
                        disabled={busy}
                        className="text-xs"
                      >
                        {busy ? 'Retrying…' : 'Retry'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
