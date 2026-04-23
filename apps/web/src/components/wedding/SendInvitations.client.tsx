'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GuestSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';

interface SendResult {
  sent?: number;
  failed?: number;
  rsvpLinks?: Array<{ guestId: string; token: string; url: string }>;
}

/**
 * Triggers POST /weddings/:id/invitations/send. The API returns a summary of
 * sends + RSVP links per guest; we surface the count + render the first few
 * tokenised links so the host can share manually if the channel mock doesn't
 * actually deliver (dev mode).
 */
export function SendInvitations({
  weddingId,
  guests,
}: {
  weddingId: string;
  guests: GuestSummary[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(guests.filter((g) => g.rsvpStatus === 'PENDING').map((g) => g.id)),
  );
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (selectedIds.size === 0) {
      setError('Select at least one guest');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/weddings/${weddingId}/invitations/send`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guestIds: Array.from(selectedIds),
              channel,
              ...(message.trim() ? { message: message.trim() } : {}),
            }),
          },
        );
        if (!res.ok) {
          setError(`Failed (${res.status})`);
          return;
        }
        const json = (await res.json()) as { success: boolean; data: SendResult };
        if (json.success) {
          setResult(json.data);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error');
      }
    });
  };

  return (
    <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg text-[#7B2D42]">Send Invitations</h2>
        <span className="text-xs text-[#64748B]">
          {selectedIds.size} of {guests.length} selected
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <label className="text-xs">
          <span className="block text-[#64748B] mb-1">Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="w-full border border-[#C5A47E]/30 rounded-lg px-3 py-2"
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="block text-[#64748B] mb-1">Personal note (optional)</span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            placeholder="With love, Priya & Rohan"
            className="w-full border border-[#C5A47E]/30 rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <div className="max-h-40 overflow-y-auto border border-[#C5A47E]/20 rounded-lg mb-3">
        {guests.map((g) => (
          <label key={g.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#FEFAF6]">
            <input
              type="checkbox"
              checked={selectedIds.has(g.id)}
              onChange={() => toggle(g.id)}
            />
            <span className="flex-1">{g.name}</span>
            <span className="text-xs text-[#64748B]">{g.rsvpStatus}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || selectedIds.size === 0}
        className="rounded-lg bg-[#7B2D42] text-white px-4 py-2 text-sm font-medium hover:bg-[#5E1F30] disabled:opacity-50"
      >
        {pending ? 'Sending…' : `Send ${selectedIds.size} invitation${selectedIds.size === 1 ? '' : 's'}`}
      </button>

      {result && (
        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
          <p className="font-medium">
            Sent {result.sent ?? 0} · Failed {result.failed ?? 0}
          </p>
          {result.rsvpLinks && result.rsvpLinks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.rsvpLinks.slice(0, 5).map((l) => (
                <li key={l.guestId} className="truncate">
                  <a href={l.url} className="underline" target="_blank" rel="noreferrer">
                    {l.url}
                  </a>
                </li>
              ))}
              {result.rsvpLinks.length > 5 && (
                <li>…and {result.rsvpLinks.length - 5} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
