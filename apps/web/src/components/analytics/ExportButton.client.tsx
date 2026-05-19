'use client';

import { Download } from 'lucide-react';
import type { Overview, SignupPoint, MatchWeek } from './types';

interface ExportButtonProps {
  overview: Overview | null;
  signups: SignupPoint[] | null;
  matches: MatchWeek[] | null;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportButton({ overview, signups, matches }: ExportButtonProps) {
  function download() {
    const header = [
      'date',
      'signups',
      'matches_sent',
      'matches_accepted',
      'revenue_mtd',
      'avg_compat_score',
    ];
    const rows: Array<Array<string | number>> = [];
    const revenue = overview?.revenueMtd.value ?? '';
    const avg = overview?.avgCompatScore.value ?? '';

    (signups ?? []).forEach((d, i) => {
      rows.push([d.date, d.count, '', '', i === 0 ? revenue : '', i === 0 ? avg : '']);
    });
    (matches ?? []).forEach((m) => {
      rows.push([m.week, '', m.sent, m.accepted, '', '']);
    });
    if (rows.length === 0) rows.push(['', '', '', '', revenue, avg]);

    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-shaadi-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      <Download className="h-4 w-4" aria-hidden />
      Export Report
    </button>
  );
}
