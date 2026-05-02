'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { VendorBlockedDate } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface BlockedDatesManagerProps {
  initial: VendorBlockedDate[];
}

export function BlockedDatesManager({ initial }: BlockedDatesManagerProps) {
  const [list, setList] = useState<VendorBlockedDate[]>(initial);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    if (!date) { setError('Pick a date'); return; }
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/blocked-dates`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ date, reason: reason.trim() || undefined }),
        });
        const json = await res.json() as { success: boolean; data?: { blocked: VendorBlockedDate }; error?: { message?: string } };
        if (!res.ok || !json.success || !json.data) {
          setError(json.error?.message ?? 'Failed to block date');
          return;
        }
        setList((prev) => [...prev, json.data!.blocked].sort((a, b) => a.date.localeCompare(b.date)));
        setDate('');
        setReason('');
      } catch {
        setError('Network error');
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/blocked-dates/${id}`, {
          method:      'DELETE',
          credentials: 'include',
        });
        if (res.ok) setList((prev) => prev.filter((d) => d.id !== id));
      } catch { /* swallow */ }
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gold/30 bg-surface p-4">
        <p className="text-sm font-semibold text-primary mb-2">Block a new date</p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sm:col-span-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Reason (optional)"
            className="sm:col-span-6 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-semibold px-3 py-2 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Block
          </button>
        </div>
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/30 bg-surface p-6 text-center text-sm text-muted-foreground">
          No blocked dates yet. Block dates when you're unavailable so customers can't book.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-gold/30 bg-surface px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {d.reason && <p className="text-xs text-muted-foreground">{d.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(d.id)}
                aria-label="Remove blocked date"
                className="rounded-lg p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
