'use client';

/**
 * Service enquiry form — Phase 8, Unit 8.2.
 *
 * Enquiries against placeholder partners are answered from the ADMIN triage
 * queue rather than by the partner, since a seeded partner has no user account.
 * The customer is not shown that distinction — the lead is real and gets a real
 * reply either way.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { createServiceEnquiryAction } from './actions';

type Contact = 'EMAIL' | 'PHONE' | 'WHATSAPP';

export function ServiceEnquiryForm({ serviceId }: { serviceId: string }) {
  const t = useTranslations('postMarriage.enquiry');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState<Contact | ''>('');
  const [city, setCity] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 10;
  const canSubmit = trimmed.length >= 10 && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    const result = await createServiceEnquiryAction({
      serviceId,
      message: trimmed,
      ...(contact ? { preferredContact: contact } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
    });

    setPending(false);
    if (result.success) {
      setDone(true);
      setMessage(''); setContact(''); setCity('');
    } else {
      setError(result.error ?? t('genericError'));
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
        <p className="mt-2 font-heading text-lg text-primary">{t('sentTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('sentBody')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="svc-message" className="text-sm font-medium text-primary">
          {t('messageLabel')}
        </label>
        <textarea
          id="svc-message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          placeholder={t('messagePlaceholder')}
          aria-describedby={tooShort ? 'svc-message-hint' : undefined}
          className="mt-1 w-full rounded-lg border border-gold/40 bg-background p-3 text-primary placeholder:text-muted focus:border-teal focus:outline-none"
        />
        {tooShort && (
          <p id="svc-message-hint" className="mt-1 text-xs text-warning">{t('tooShort')}</p>
        )}
      </div>

      <div>
        <label htmlFor="svc-contact" className="text-sm font-medium text-primary">
          {t('contactLabel')}
        </label>
        <select
          id="svc-contact"
          value={contact}
          onChange={(e) => setContact(e.currentTarget.value as Contact | '')}
          className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
        >
          <option value="">—</option>
          <option value="EMAIL">{t('contactOptions.EMAIL')}</option>
          <option value="PHONE">{t('contactOptions.PHONE')}</option>
          <option value="WHATSAPP">{t('contactOptions.WHATSAPP')}</option>
        </select>
      </div>

      <div>
        <label htmlFor="svc-city" className="text-sm font-medium text-primary">
          {t('cityLabel')}
        </label>
        <input
          id="svc-city"
          type="text"
          value={city}
          onChange={(e) => setCity(e.currentTarget.value)}
          className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
        />
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
    </form>
  );
}
