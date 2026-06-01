'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
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
  const t = useTranslations('weddings.invite.send');
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
      setError(t('selectAtLeastOne'));
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
          setError(t('failed', { status: res.status }));
          return;
        }
        const json = (await res.json()) as { success: boolean; data: SendResult };
        if (json.success) {
          setResult(json.data);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('networkError'));
      }
    });
  };

  return (
    <div className="bg-surface border border-gold/20 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg text-primary">{t('heading')}</h2>
        <span className="text-xs text-muted-foreground">
          {t('selectedCount', { selected: selectedIds.size, total: guests.length })}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">{t('channel')}</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="w-full border border-gold/30 rounded-lg px-3 py-2"
          >
            <option value="EMAIL">{t('email')}</option>
            <option value="SMS">{t('sms')}</option>
            <option value="WHATSAPP">{t('whatsapp')}</option>
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="block text-muted-foreground mb-1">{t('note')}</span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            placeholder={t('notePlaceholder')}
            className="w-full border border-gold/30 rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <div className="max-h-40 overflow-y-auto border border-gold/20 rounded-lg mb-3">
        {guests.map((g) => (
          <label key={g.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-background">
            <input
              type="checkbox"
              checked={selectedIds.has(g.id)}
              onChange={() => toggle(g.id)}
            />
            <span className="flex-1">{g.name}</span>
            <span className="text-xs text-muted-foreground">{g.rsvpStatus}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || selectedIds.size === 0}
        className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? t('sending') : t('send', { count: selectedIds.size })}
      </button>

      {result && (
        <div className="mt-4 rounded-lg bg-success/10 border border-success/30 p-3 text-xs text-success">
          <p className="font-medium">
            {t('result', { sent: result.sent ?? 0, failed: result.failed ?? 0 })}
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
                <li>{t('andMore', { count: result.rsvpLinks.length - 5 })}</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
