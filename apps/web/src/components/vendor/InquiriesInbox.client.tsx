'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { VendorInquiry, InquiryStatus } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface InquiriesInboxProps {
  initial: VendorInquiry[];
}

const STATUS_FILTERS: Array<{ value: InquiryStatus | ''; label: string }> = [
  { value: '',          label: 'All' },
  { value: 'NEW',       label: 'New' },
  { value: 'REPLIED',   label: 'Replied' },
  { value: 'CONVERTED', label: 'Booked' },
  { value: 'CLOSED',    label: 'Closed' },
];

export function InquiriesInbox({ initial }: InquiriesInboxProps) {
  const router = useRouter();
  const [list, setList] = useState<VendorInquiry[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [filter, setFilter] = useState<InquiryStatus | ''>('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = filter ? list.filter((i) => i.status === filter) : list;
  const active = list.find((i) => i.id === activeId) ?? null;

  function reload() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`${API_URL}/api/v1/vendors/inquiries?limit=50${filter ? `&status=${filter}` : ''}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json() as { success: boolean; data?: { inquiries: VendorInquiry[] } };
      if (json.success && json.data) setList(json.data.inquiries);
    });
  }

  function send(status: InquiryStatus) {
    if (!active) return;
    if (reply.trim().length < 1) { setError('Reply is empty'); return; }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/inquiries/${active.id}/reply`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ reply: reply.trim(), status }),
        });
        const json = await res.json() as { success: boolean; data?: { inquiry: VendorInquiry }; error?: { message?: string } };
        if (!res.ok || !json.success || !json.data) {
          setError(json.error?.message ?? 'Failed to reply');
          return;
        }
        setList((prev) => prev.map((i) => (i.id === active.id ? { ...i, ...json.data!.inquiry } : i)));
        setReply('');
        router.refresh();
      } catch {
        setError('Network error');
      }
    });
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gold/30 bg-surface p-8 text-center text-sm text-muted-foreground">
        No inquiries yet. Customers will message you here before booking.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value || 'all'}
            type="button"
            onClick={() => { setFilter(s.value); reload(); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s.value ? 'bg-teal text-white' : 'bg-surface text-muted-foreground border border-border hover:bg-gold/10'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <ul className="lg:col-span-5 space-y-2 max-h-[60vh] overflow-y-auto">
          {visible.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setActiveId(i.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  activeId === i.id ? 'border-teal bg-teal/5' : 'border-gold/30 bg-surface hover:bg-gold/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-primary truncate">{i.customerName ?? 'Customer'}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    i.status === 'NEW'       ? 'bg-amber-100 text-amber-700' :
                    i.status === 'REPLIED'   ? 'bg-teal/15 text-teal' :
                    i.status === 'CONVERTED' ? 'bg-green-100 text-green-700' :
                                               'bg-secondary text-muted-foreground'
                  }`}>{i.status}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{i.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {i.eventDate && `📅 ${new Date(i.eventDate).toLocaleDateString('en-IN')}`}
                  {i.budgetMin != null && ` · ₹${i.budgetMin.toLocaleString('en-IN')}+`}
                </p>
              </button>
            </li>
          ))}
        </ul>

        <div className="lg:col-span-7">
          {active ? (
            <div className="rounded-xl border border-gold/30 bg-surface p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-primary">{active.customerName ?? 'Customer'}</p>
                <p className="text-xs text-muted-foreground">
                  Sent {new Date(active.createdAt).toLocaleDateString('en-IN')}
                  {active.eventDate && ` · Event ${new Date(active.eventDate).toLocaleDateString('en-IN')}`}
                  {active.guestCount && ` · ${active.guestCount} guests`}
                </p>
                {(active.budgetMin != null || active.budgetMax != null) && (
                  <p className="text-xs text-muted-foreground">
                    Budget: ₹{active.budgetMin?.toLocaleString('en-IN') ?? '?'} – ₹{active.budgetMax?.toLocaleString('en-IN') ?? '?'}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-background border border-gold/20 px-3 py-2 text-sm whitespace-pre-line">
                {active.message}
              </div>
              {active.vendorReply && (
                <div className="rounded-lg bg-teal/5 border border-teal/30 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-teal mb-1">Your reply</p>
                  <p className="whitespace-pre-line">{active.vendorReply}</p>
                </div>
              )}

              <div>
                <label htmlFor="i-reply" className="block text-xs font-medium text-muted-foreground mb-1">
                  Reply
                </label>
                <textarea
                  id="i-reply"
                  rows={4}
                  maxLength={2000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write your response…"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => send('REPLIED')}
                  disabled={pending}
                  className="rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
                >
                  {pending ? 'Sending…' : 'Send reply'}
                </button>
                <button
                  type="button"
                  onClick={() => send('CONVERTED')}
                  disabled={pending}
                  className="rounded-lg border border-success text-success text-sm font-medium px-4 py-2 hover:bg-green-50 disabled:opacity-60"
                >
                  Mark booked
                </button>
                <button
                  type="button"
                  onClick={() => send('CLOSED')}
                  disabled={pending}
                  className="rounded-lg border border-border text-muted-foreground text-sm font-medium px-4 py-2 hover:bg-gold/10 disabled:opacity-60"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gold/30 bg-surface p-6 text-center text-sm text-muted-foreground">
              Select an inquiry to reply.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
