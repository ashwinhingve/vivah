'use client';

import { useState, useTransition } from 'react';
import { MessageSquare, X } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const CEREMONY_TYPES = [
  'WEDDING','HALDI','MEHNDI','SANGEET','ENGAGEMENT','RECEPTION',
  'CORPORATE','FESTIVAL','COMMUNITY','GOVERNMENT','SCHOOL','OTHER',
] as const;

interface InquiryDialogProps {
  vendorId:   string;
  vendorName: string;
  className?: string;
}

export function InquiryDialog({ vendorId, vendorName, className = '' }: InquiryDialogProps) {
  const [open, setOpen]         = useState(false);
  const [success, setSuccess]   = useState(false);
  const [ceremonyType, setCt]   = useState<string>('WEDDING');
  const [eventDate, setDate]    = useState('');
  const [guestCount, setGuests] = useState('');
  const [budgetMin, setBmin]    = useState('');
  const [budgetMax, setBmax]    = useState('');
  const [message, setMessage]   = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setSuccess(false);
    setError(null);
    setCt('WEDDING');
    setDate('');
    setGuests('');
    setBmin('');
    setBmax('');
    setMessage('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) {
      setError('Message must be at least 5 characters.');
      return;
    }

    const payload: Record<string, unknown> = { message: message.trim() };
    if (ceremonyType) payload['ceremonyType'] = ceremonyType;
    if (eventDate)    payload['eventDate']    = eventDate;
    if (guestCount)   payload['guestCount']   = parseInt(guestCount, 10);
    if (budgetMin)    payload['budgetMin']    = parseFloat(budgetMin);
    if (budgetMax)    payload['budgetMax']    = parseFloat(budgetMax);

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/${vendorId}/inquiries`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(payload),
        });
        const json = await res.json() as { success: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? 'Failed to send inquiry');
          return;
        }
        setSuccess(true);
      } catch {
        setError('Network error');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-surface px-4 py-2.5 text-sm font-medium text-primary hover:bg-gold/10 transition-colors min-h-[44px] ${className}`}
      >
        <MessageSquare className="h-4 w-4" /> Ask a question
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="font-semibold text-primary">Ask {vendorName}</p>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-gold/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {success ? (
              <div className="px-5 py-8 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-teal/10 flex items-center justify-center text-2xl">✓</div>
                <p className="text-sm font-medium text-primary">Inquiry sent!</p>
                <p className="text-xs text-muted-foreground">{vendorName} will reply via your inquiries inbox.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-medium px-4 py-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="i-type" className="block text-xs font-medium text-muted-foreground mb-1">Ceremony</label>
                    <select
                      id="i-type"
                      value={ceremonyType}
                      onChange={(e) => setCt(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                    >
                      {CEREMONY_TYPES.map((c) => (
                        <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="i-date" className="block text-xs font-medium text-muted-foreground mb-1">Event date</label>
                    <input
                      id="i-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                  </div>
                  <div>
                    <label htmlFor="i-guests" className="block text-xs font-medium text-muted-foreground mb-1">Guest count</label>
                    <input
                      id="i-guests"
                      type="number"
                      min={1}
                      value={guestCount}
                      onChange={(e) => setGuests(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Budget (₹)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Min"
                        min={0}
                        value={budgetMin}
                        onChange={(e) => setBmin(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <input
                        type="number"
                        placeholder="Max"
                        min={0}
                        value={budgetMax}
                        onChange={(e) => setBmax(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="i-msg" className="block text-xs font-medium text-muted-foreground mb-1">Message *</label>
                  <textarea
                    id="i-msg"
                    rows={4}
                    maxLength={2000}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell the vendor what you're looking for…"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                  />
                </div>

                {error && <p className="text-sm text-red-700">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-gold/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-medium px-4 py-2 min-h-[40px] disabled:opacity-60"
                  >
                    {pending ? 'Sending…' : 'Send inquiry'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
