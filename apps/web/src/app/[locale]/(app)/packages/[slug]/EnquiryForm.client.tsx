'use client';

/**
 * Package enquiry form — Phase 8, Unit 8.1.
 *
 * `bookable` is the SERVER's answer from /booking-check, not a client reading of
 * `isPlaceholder`. When false the booking CTA is simply absent; the enquiry path
 * is identical either way, because capturing the lead is what preview inventory
 * is for.
 *
 * Note what this does NOT do: it never tells the user the listing is a
 * placeholder. That would be the user-facing restriction the flag is
 * specified not to impose. "Request a quote" is a normal, honest CTA for a
 * destination package — these are quoted, not bought off a shelf.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { createPackageEnquiryAction } from './actions';

interface Props {
  packageId: string;
  bookable: boolean;
}

export function EnquiryForm({ packageId, bookable }: Props) {
  const t = useTranslations('packages.enquiry');
  const [message, setMessage] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors the API's z.string().min(10) so the user is told before a round
  // trip. The server still validates — this is convenience, not enforcement.
  const tooShort = message.trim().length > 0 && message.trim().length < 10;
  const canSubmit = message.trim().length >= 10 && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    const result = await createPackageEnquiryAction({
      packageId,
      message: message.trim(),
      ...(eventDate ? { eventDate } : {}),
      ...(guestCount ? { guestCount: Number(guestCount) } : {}),
    });

    setPending(false);
    if (result.success) {
      setDone(true);
      setMessage(''); setEventDate(''); setGuestCount('');
    } else {
      setError(result.error ?? t('genericError'));
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-lg border border-success/30 bg-success/5 p-4 text-center"
      >
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
        <p className="mt-2 font-heading text-lg text-primary">{t('sentTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('sentBody')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="enq-message" className="text-sm font-medium text-primary">
          {t('messageLabel')}
        </label>
        <textarea
          id="enq-message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          placeholder={t('messagePlaceholder')}
          aria-describedby={tooShort ? 'enq-message-hint' : undefined}
          className="mt-1 w-full rounded-lg border border-gold/40 bg-background p-3 text-primary placeholder:text-muted focus:border-teal focus:outline-none"
        />
        {tooShort && (
          <p id="enq-message-hint" className="mt-1 text-xs text-warning">
            {t('tooShort')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="enq-date" className="text-sm font-medium text-primary">
            {t('dateLabel')}
          </label>
          <input
            id="enq-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.currentTarget.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="enq-guests" className="text-sm font-medium text-primary">
            {t('guestsLabel')}
          </label>
          <input
            id="enq-guests"
            type="number"
            inputMode="numeric"
            min={1}
            value={guestCount}
            onChange={(e) => setGuestCount(e.currentTarget.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {pending ? t('sending') : t('submit')}
      </button>

      {/* Only drawn when the SERVER said this package can take money. */}
      {bookable && (
        <button
          type="button"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-teal px-6 text-teal transition hover:bg-teal/10"
        >
          {t('bookNow')}
        </button>
      )}
    </form>
  );
}
