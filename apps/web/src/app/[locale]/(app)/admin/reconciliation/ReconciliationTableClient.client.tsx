'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { cn } from '@/lib/utils';

interface Discrepancy {
  id: string;
  paymentId: string | null;
  razorpayPaymentId: string | null;
  field: string;
  expected: string | null;
  actual: string | null;
  status: string;
  notes: string | null;
  detectedAt: string;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function ReconciliationTableClient({ items }: { items: Discrepancy[] }) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const router = useRouter();

  const filtered = filter === 'OPEN' ? items.filter((i) => i.status === 'OPEN') : items;
  const openCount = items.filter((i) => i.status === 'OPEN').length;

  function resolve(id: string): void {
    startTransition(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/payments/admin/reconciliation/${id}/resolve`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'RESOLVED' }),
          }
        );
        if (res.ok) router.refresh();
      } catch {
        /* noop */
      }
    });
  }

  const columns: DataTableColumn<Discrepancy>[] = [
    {
      key: 'paymentId',
      header: 'Payment ID',
      render: (i) => (
        <span className="font-mono text-xs">{i.razorpayPaymentId ?? i.paymentId ?? '–'}</span>
      ),
    },
    { key: 'field', header: 'Field' },
    { key: 'expected', header: 'Expected', render: (i) => i.expected ?? '–' },
    {
      key: 'actual',
      header: 'Actual',
      render: (i) => <span className="text-destructive">{i.actual ?? '–'}</span>,
    },
    {
      key: 'detectedAt',
      header: 'Detected',
      render: (i) => (
        <span className="text-muted-foreground">
          {new Date(i.detectedAt).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => (
        <span
          className={cn(
            'text-xs font-medium',
            i.status === 'OPEN' ? 'text-warning' : 'text-success'
          )}
        >
          {i.status}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (i) =>
        i.status === 'OPEN' ? (
          <Button size="sm" onClick={() => resolve(i.id)} disabled={pending} className="text-xs">
            Mark resolved
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Reconciliation filter"
        className="mb-4 flex items-center gap-3"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={filter === 'OPEN'}
          variant={filter === 'OPEN' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('OPEN')}
        >
          Open ({openCount})
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={filter === 'ALL'}
          variant={filter === 'ALL' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('ALL')}
        >
          All ({items.length})
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(i) => i.id}
        empty={{
          title: 'No discrepancies',
          description:
            filter === 'OPEN'
              ? 'No open discrepancies. Settlements match local ledger.'
              : 'No discrepancies on record.',
        }}
      />
    </div>
  );
}
