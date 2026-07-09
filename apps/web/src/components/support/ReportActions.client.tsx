'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldX, ArrowUpRight } from 'lucide-react';
import { actOnReportAction } from '@/app/[locale]/(app)/support/actions';

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: 'DISMISS' | 'ESCALATE') {
    setError(null);
    startTransition(async () => {
      const r = await actOnReportAction(reportId, action);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run('DISMISS')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-muted hover:border-gold/40 disabled:opacity-50"
        >
          <ShieldX className="h-3.5 w-3.5" /> Dismiss
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run('ESCALATE')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-warning px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> Escalate to ticket
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
