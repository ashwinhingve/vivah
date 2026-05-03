'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_TABS: { value: PayoutStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  SCHEDULED: { className: 'bg-warning/15 text-warning', label: 'Scheduled' },
  PROCESSING: { className: 'bg-teal/10 text-teal', label: 'Processing' },
  COMPLETED: { className: 'bg-success/15 text-success', label: 'Completed' },
  FAILED: { className: 'bg-destructive/15 text-destructive', label: 'Failed' },
  ON_HOLD: { className: 'bg-warning/20 text-warning', label: 'On Hold' },
};

interface Props {
  initialPayouts: PayoutRecord[];
  initialStatus: PayoutStatus | 'ALL';
}

export function AdminPayoutsClient({ initialPayouts, initialStatus }: Props) {
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutRecord[]>(initialPayouts);
  const [filter, setFilter] = useState<PayoutStatus | 'ALL'>(initialStatus);
  const [actingId, setActingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function switchFilter(status: PayoutStatus | 'ALL') {
    setFilter(status);
    const qs = status !== 'ALL' ? `?status=${status}` : '';
    router.push(`/admin/payouts${qs}`);
  }

  const displayed = filter === 'ALL' ? payouts : payouts.filter((p) => p.status === filter);

  async function processNow(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/payouts/admin/${id}/process`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; data?: PayoutRecord; error?: string };
      if (!res.ok || !json.success) {
        setErrors((prev) => ({ ...prev, [id]: json.error ?? 'Failed to process payout.' }));
        return;
      }
      if (json.data) {
        setPayouts((prev) => prev.map((p) => (p.id === id ? json.data! : p)));
      }
    } catch {
      setErrors((prev) => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setActingId(null);
    }
  }

  async function retryPayout(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/payouts/admin/${id}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; data?: PayoutRecord; error?: string };
      if (!res.ok || !json.success) {
        setErrors((prev) => ({ ...prev, [id]: json.error ?? 'Failed to retry payout.' }));
        return;
      }
      if (json.data) {
        setPayouts((prev) => prev.map((p) => (p.id === id ? json.data! : p)));
      }
    } catch {
      setErrors((prev) => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="default">
        <PageHeader
          title="Vendor Payouts"
          subtitle="Manage and process vendor payout disbursements"
        />

        <div
          role="tablist"
          aria-label="Payout status filter"
          className="mb-5 flex gap-1.5 overflow-x-auto pb-1"
        >
          {STATUS_TABS.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchFilter(tab.value)}
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

        {displayed.length === 0 ? (
          <EmptyState
            title="No payouts found"
            description="No payouts match the current filter."
          />
        ) : (
          <ul className="space-y-3">
            {displayed.map((payout) => {
              const badge =
                STATUS_BADGE[payout.status] ?? {
                  className: 'bg-secondary text-muted-foreground',
                  label: payout.status,
                };
              const err = errors[payout.id];
              const busy = actingId === payout.id;
              return (
                <li
                  key={payout.id}
                  className="rounded-xl border border-gold bg-surface p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        Vendor {payout.vendorId.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Scheduled: {formatDate(payout.scheduledFor)} · Processed:{' '}
                        {formatDate(payout.processedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatINR(payout.netAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Gross {formatINR(payout.grossAmount)} − Fee {formatINR(payout.platformFee)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                    {payout.attempts > 1 ? (
                      <span className="text-xs text-muted-foreground">
                        Attempt {payout.attempts}
                      </span>
                    ) : null}
                  </div>

                  {payout.failureReason ? (
                    <p className="mt-2 text-xs text-destructive">
                      Reason: {payout.failureReason}
                    </p>
                  ) : null}

                  {err ? (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                      {err}
                    </p>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    {payout.status === 'SCHEDULED' || payout.status === 'ON_HOLD' ? (
                      <Button
                        size="sm"
                        onClick={() => processNow(payout.id)}
                        disabled={busy}
                        className="text-xs"
                      >
                        {busy ? 'Processing…' : 'Process Now'}
                      </Button>
                    ) : null}
                    {payout.status === 'FAILED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryPayout(payout.id)}
                        disabled={busy}
                        className="text-xs"
                      >
                        {busy ? 'Retrying…' : 'Retry'}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </main>
  );
}
