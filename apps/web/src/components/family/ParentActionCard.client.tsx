'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveAction, rejectAction, type DraftedAction } from '@/lib/family-mode-api';

interface Props {
  action: DraftedAction;
}

function describePayload(action: DraftedAction): string {
  const p = action.payload as { targetProfileId?: string; message?: string; field?: string; value?: unknown };
  switch (action.actionType) {
    case 'SEND_INTEREST':
      return `Send interest to profile ${p.targetProfileId ?? '(unknown)'}${p.message ? ` — "${p.message}"` : ''}`;
    case 'ACCEPT_INTEREST':  return `Accept interest from ${p.targetProfileId ?? '(unknown)'}`;
    case 'REJECT_INTEREST':  return `Reject interest from ${p.targetProfileId ?? '(unknown)'}`;
    case 'SEND_MESSAGE':     return `Send message: "${p.message ?? ''}"`;
    case 'UPDATE_PROFILE':   return `Update profile field ${p.field ?? '?'}`;
    case 'BLOCK_USER':       return `Block user ${p.targetProfileId ?? '(unknown)'}`;
    default:                 return action.actionType;
  }
}

function timeUntil(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hrs}h left`;
  return `${hrs}h left`;
}

export function ParentActionCard({ action }: Props) {
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function handle(kind: 'approve' | 'reject') {
    setErr(null);
    startTransition(async () => {
      const result = kind === 'approve'
        ? await approveAction(action.id)
        : await rejectAction(action.id);
      if (!result) { setErr('Action failed.'); return; }
      router.refresh();
    });
  }

  const isPending = action.status === 'PENDING';

  return (
    <article className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="inline-block rounded-full bg-teal/10 text-teal text-xs px-2 py-0.5">
            {action.actionType.replace(/_/g, ' ')}
          </span>
          <p className="text-sm text-foreground">{describePayload(action)}</p>
          <p className="text-xs text-gold-muted">
            Drafted {new Date(action.parentDraftedAt).toLocaleString()} · {timeUntil(action.expiresAt)}
          </p>
        </div>
        <span className={`text-xs uppercase tracking-wide ${
          action.status === 'EXECUTED' ? 'text-success' :
          action.status === 'REJECTED' ? 'text-destructive' :
          action.status === 'EXPIRED'  ? 'text-muted-foreground' :
          'text-warning'
        }`}>
          {action.status}
        </span>
      </div>

      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

      {isPending && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handle('approve')}
            className="rounded-lg bg-primary text-primary-foreground px-4 h-10 text-sm hover:opacity-95 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handle('reject')}
            className="rounded-lg border border-destructive/40 text-destructive px-4 h-10 text-sm hover:bg-destructive/5 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}
    </article>
  );
}
