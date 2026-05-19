'use client';

import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { TopMatch } from './types';

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TopMatchesTable({ data }: { data: TopMatch[] | null }) {
  const [desc, setDesc] = useState(true);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-gold/20 bg-surface px-6 py-10 text-center text-sm text-text-muted">
        No scored matches yet.
      </div>
    );
  }

  const rows = [...data].sort((a, b) =>
    desc ? b.totalScore - a.totalScore : a.totalScore - b.totalScore,
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-gold/20 bg-surface shadow-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gold/20 text-xs uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3 font-semibold">User A</th>
            <th className="px-4 py-3 font-semibold">User B</th>
            <th className="px-4 py-3 font-semibold">
              <button
                type="button"
                onClick={() => setDesc((d) => !d)}
                className="inline-flex items-center gap-1 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                aria-label={`Sort by score ${desc ? 'ascending' : 'descending'}`}
              >
                Compatibility <ArrowUpDown className="h-3 w-3" aria-hidden />
              </button>
            </th>
            <th className="px-4 py-3 font-semibold">Guna Milan</th>
            <th className="px-4 py-3 font-semibold">FII Band</th>
            <th className="px-4 py-3 font-semibold">Match Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.userA}-${r.userB}-${i}`}
              className="border-b border-gold/10 last:border-0 hover:bg-surface-muted"
            >
              <td className="px-4 py-3 font-medium text-text-primary">{r.userA}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{r.userB}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-teal/10 px-2 py-0.5 font-semibold text-teal">
                  {r.totalScore}
                </span>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {r.gunaMilanScore == null ? '—' : `${r.gunaMilanScore}/36`}
              </td>
              <td className="px-4 py-3 text-text-muted">{r.fiiBand}</td>
              <td className="px-4 py-3 text-text-muted">{fmt(r.computedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
