'use client';

import { Download } from 'lucide-react';

interface AuditExportRow {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  payload: unknown;
  createdAt: string;
}

function toCsv(rows: AuditExportRow[]): string {
  const head = ['id', 'eventType', 'entityType', 'entityId', 'actorId', 'actorName', 'createdAt', 'payload'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.id, r.eventType, r.entityType, r.entityId, r.actorId, r.actorName, r.createdAt, JSON.stringify(r.payload ?? null)]
      .map(esc)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n');
}

export function AuditExportButton({ rows }: { rows: AuditExportRow[] }) {
  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log-page.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={rows.length === 0}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-primary hover:border-gold/40 disabled:opacity-50"
    >
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}
