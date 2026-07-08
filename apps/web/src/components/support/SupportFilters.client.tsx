'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { TicketPriority, TicketSource } from '@/lib/support-api';

const PRIORITIES: TicketPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
const SOURCES: TicketSource[] = ['USER', 'CHAT_REPORT', 'DISPUTE', 'KYC_APPEAL', 'SYSTEM'];

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

/**
 * Client filter bar for the support queue — pushes q / priority / source / mine
 * as URL params (the server page reads them and re-queries). Status stays owned
 * by the tab strip; this preserves it.
 */
export function SupportFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');

  function push(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    params.delete('page'); // reset paging on any filter change
    router.push(`/support?${params.toString()}`);
  }

  const priority = sp.get('priority') ?? '';
  const source = sp.get('source') ?? '';
  const mine = sp.get('mine') === 'true';
  const selectCls =
    'h-10 rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => { e.preventDefault(); push({ q: q.trim() || null }); }}
        className="relative min-w-[200px] flex-1"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject…"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-8 text-sm text-primary focus:border-teal focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); push({ q: null }); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <select
        aria-label="Priority"
        value={priority}
        onChange={(e) => push({ priority: e.target.value || null })}
        className={selectCls}
      >
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
      </select>

      <select
        aria-label="Source"
        value={source}
        onChange={(e) => push({ source: e.target.value || null })}
        className={selectCls}
      >
        <option value="">All sources</option>
        {SOURCES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
      </select>

      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-primary">
        <input
          type="checkbox"
          checked={mine}
          onChange={(e) => push({ mine: e.target.checked ? 'true' : null })}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        My tickets
      </label>
    </div>
  );
}
