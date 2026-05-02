'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface RescheduleControlsProps {
  bookingId:      string;
  currentDate:    string;
  proposedDate?:  string | null;
  proposedReason?: string | null;
  proposedByYou?: boolean;
}

export function RescheduleControls(props: RescheduleControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function call(path: string, method: 'POST' | 'PUT', body?: unknown) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/bookings/${props.bookingId}${path}`, {
          method,
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const json = await res.json() as { success: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? 'Action failed');
          return;
        }
        setOpen(false);
        setDate('');
        setReason('');
        router.refresh();
      } catch {
        setError('Network error');
      }
    });
  }

  if (props.proposedDate) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900 mb-1">
          {props.proposedByYou ? 'You proposed a new date' : 'New date proposed'}
        </p>
        <p className="text-sm text-amber-900">
          {new Date(props.proposedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' '}<span className="text-xs text-amber-700">(was {new Date(props.currentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})</span>
        </p>
        {props.proposedReason && (
          <p className="text-xs text-amber-800 mt-1 italic">"{props.proposedReason}"</p>
        )}
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        {props.proposedByYou ? (
          <button
            type="button"
            onClick={() => call('/reschedule/reject', 'PUT')}
            disabled={pending}
            className="mt-3 rounded-lg border border-amber-700 text-amber-900 text-sm font-medium px-3 py-1.5 hover:bg-amber-100 disabled:opacity-60"
          >
            {pending ? 'Cancelling…' : 'Cancel proposal'}
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => call('/reschedule/accept', 'PUT')}
              disabled={pending}
              className="rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
            >
              {pending ? 'Working…' : 'Accept new date'}
            </button>
            <button
              type="button"
              onClick={() => call('/reschedule/reject', 'PUT')}
              disabled={pending}
              className="rounded-lg border border-amber-700 text-amber-900 text-sm font-medium px-3 py-1.5 hover:bg-amber-100 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {open ? (
        <div className="rounded-xl border border-gold/40 bg-surface p-4">
          <p className="text-sm font-semibold text-primary mb-3">Propose a new date</p>
          <div className="space-y-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reason for rescheduling (required)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-gold/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!date) { setError('Pick a date'); return; }
                  if (reason.trim().length < 3) { setError('Reason required (min 3 chars)'); return; }
                  call('/reschedule', 'POST', { proposedDate: date, reason: reason.trim() });
                }}
                disabled={pending}
                className="rounded-lg bg-primary text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
              >
                {pending ? 'Sending…' : 'Send proposal'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-gold/40 bg-surface px-4 py-2 text-sm font-medium text-primary hover:bg-gold/10"
        >
          Reschedule
        </button>
      )}
    </div>
  );
}
