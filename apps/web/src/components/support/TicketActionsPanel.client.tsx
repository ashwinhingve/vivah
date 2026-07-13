'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, CheckCircle2 } from 'lucide-react';
import {
  patchTicketAction,
  assignToMeAction,
  resolveTicketAction,
} from '@/app/[locale]/(app)/support/actions';
import type { TicketPriority, TicketStatus, StaffOption } from '@/lib/support-api';

const STATUSES: TicketStatus[] = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const PRIORITIES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

interface Props {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToUserId: string | null;
  assignedToName: string | null;
  myUserId: string;
  staff: StaffOption[];
}

export function TicketActionsPanel({
  ticketId,
  status,
  priority,
  assignedToUserId,
  assignedToName,
  myUserId,
  staff,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const selectCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <h2 className="mb-4 font-heading text-lg text-primary">Actions</h2>

      <label className="mb-1 block text-xs font-medium text-text-muted">Status</label>
      <select
        className={selectCls}
        defaultValue={status}
        disabled={pending}
        onChange={(e) => run(() => patchTicketAction(ticketId, { status: e.target.value as TicketStatus }))}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
        ))}
      </select>

      <label className="mb-1 mt-4 block text-xs font-medium text-text-muted">Priority</label>
      <select
        className={selectCls}
        defaultValue={priority}
        disabled={pending}
        onChange={(e) => run(() => patchTicketAction(ticketId, { priority: e.target.value as TicketPriority }))}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
        ))}
      </select>

      <div className="mt-4 space-y-2">
        <p className="text-xs text-text-muted">
          Assignee: <span className="font-medium text-primary">{assignedToName ?? 'Unassigned'}</span>
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => assignToMeAction(ticketId, myUserId))}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal/5 text-sm font-medium text-teal hover:bg-teal/10 disabled:opacity-50"
        >
          <UserCheck className="h-4 w-4" /> Assign to me
        </button>
        {staff.length > 0 && (
          <div>
            <label htmlFor="reassign" className="mb-1 block text-xs font-medium text-text-muted">
              Reassign to
            </label>
            <select
              id="reassign"
              className={selectCls}
              defaultValue={assignedToUserId ?? ''}
              disabled={pending}
              onChange={(e) =>
                run(() => patchTicketAction(ticketId, { assignedToUserId: e.target.value || null }))
              }
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? 'Unnamed staff'}
                </option>
              ))}
            </select>
          </div>
        )}
        {status !== 'RESOLVED' && status !== 'CLOSED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resolveTicketAction(ticketId))}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-success text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Mark resolved
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
