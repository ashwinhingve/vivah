'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Discrepancy {
  id:                string;
  paymentId:         string | null;
  razorpayPaymentId: string | null;
  field:             string;
  expected:          string | null;
  actual:            string | null;
  status:            string;
  notes:             string | null;
  detectedAt:        string;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function ReconciliationTableClient({ items }: { items: Discrepancy[] }) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const router = useRouter();

  const filtered = filter === 'OPEN' ? items.filter(i => i.status === 'OPEN') : items;

  function resolve(id: string): void {
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/payments/admin/reconciliation/${id}/resolve`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ status: 'RESOLVED' }),
        });
        if (res.ok) router.refresh();
      } catch { /* noop */ }
    });
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
        No {filter === 'OPEN' ? 'open' : ''} discrepancies. Settlements match local ledger.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setFilter('OPEN')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'OPEN' ? 'bg-[#0A1F4D] text-white' : 'border border-slate-200'}`}
        >Open ({items.filter(i => i.status === 'OPEN').length})</button>
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'ALL' ? 'bg-[#0A1F4D] text-white' : 'border border-slate-200'}`}
        >All ({items.length})</button>
      </div>
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Payment ID</th>
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Expected</th>
            <th className="px-4 py-3">Actual</th>
            <th className="px-4 py-3">Detected</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {filtered.map(i => (
            <tr key={i.id}>
              <td className="px-4 py-3 font-mono text-xs">{i.razorpayPaymentId ?? i.paymentId ?? '–'}</td>
              <td className="px-4 py-3">{i.field}</td>
              <td className="px-4 py-3">{i.expected ?? '–'}</td>
              <td className="px-4 py-3 text-red-700">{i.actual ?? '–'}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(i.detectedAt).toLocaleString()}</td>
              <td className="px-4 py-3"><span className={i.status === 'OPEN' ? 'text-amber-700' : 'text-emerald-700'}>{i.status}</span></td>
              <td className="px-4 py-3">
                {i.status === 'OPEN' ? (
                  <button
                    onClick={() => resolve(i.id)}
                    disabled={pending}
                    className="px-3 py-1.5 rounded-lg bg-[#0A1F4D] text-white text-xs hover:bg-[#1848C8] disabled:opacity-50"
                  >Mark resolved</button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
