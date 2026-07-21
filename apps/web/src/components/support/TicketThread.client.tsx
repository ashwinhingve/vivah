'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Lock, Send, MessageSquare } from 'lucide-react';
import { addTicketMessageAction } from '@/app/[locale]/(app)/support/actions';
import type { TicketMessageView } from '@/lib/support-api';
import { cn } from '@/lib/utils';

interface Props {
  ticketId: string;
  messages: TicketMessageView[];
  myUserId: string;
}

// Map canned reply IDs to i18n keys — staff select by label, display by locale.
const CANNED_REPLIES_MAP: Record<'acknowledge' | 'moreInfo' | 'resolved' | 'escalated' | 'closing', {
  labelKey: string;
  bodyKey: string;
}> = {
  acknowledge: { labelKey: 'support.canned.acknowledge.label', bodyKey: 'support.canned.acknowledge.body' },
  moreInfo: { labelKey: 'support.canned.moreInfo.label', bodyKey: 'support.canned.moreInfo.body' },
  resolved: { labelKey: 'support.canned.resolved.label', bodyKey: 'support.canned.resolved.body' },
  escalated: { labelKey: 'support.canned.escalated.label', bodyKey: 'support.canned.escalated.body' },
  closing: { labelKey: 'support.canned.closing.label', bodyKey: 'support.canned.closing.body' },
};

function getLocaleTag(locale: string): string {
  if (locale === 'hi') return 'hi-IN';
  return 'en-IN';
}

export function TicketThread({ ticketId, messages, myUserId }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const localeTag = getLocaleTag(locale);
  const [body, setBody] = useState('');
  const [cannedValue, setCannedValue] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  function submit() {
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const r = await addTicketMessageAction(ticketId, text, isInternalNote);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBody('');
      setIsInternalNote(false);
      router.refresh();
    });
  }

  function formatWhen(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(localeTag, { day: 'numeric', month: 'short' }) +
      ' · ' +
      d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    );
  }

  const cannedReplies = Object.entries(CANNED_REPLIES_MAP).map(([id, keys]) => ({
    id,
    label: t(keys.labelKey),
    body: t(keys.bodyKey),
  }));

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <MessageSquare className="h-4 w-4 text-teal" />
        <h2 className="font-heading text-lg text-primary">{t('support.thread.title')}</h2>
        <span className="text-xs text-text-muted">({messages.length})</span>
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            {t('support.thread.emptyState')}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.authorUserId === myUserId;
          return (
            <div
              key={m.id}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm',
                m.isInternalNote
                  ? 'border-warning/30 bg-warning/5'
                  : mine
                    ? 'border-teal/20 bg-teal/5'
                    : 'border-border bg-background',
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
                <span className="font-medium text-primary">{m.authorName ?? 'System'}</span>
                {m.isInternalNote && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning">
                    <Lock className="h-3 w-3" /> {t('support.thread.internalNoteLabel')}
                  </span>
                )}
                <span className="ml-auto">{mounted ? formatWhen(m.createdAt) : '—'}</span>
              </div>
              <p className="whitespace-pre-wrap text-text">{m.body}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border px-4 py-3 sm:px-6">
        <div className="mb-2 flex justify-end">
          <select
            aria-label={t('support.thread.cannedReplyPlaceholder')}
            value={cannedValue}
            disabled={pending}
            onChange={(e) => {
              const preset = cannedReplies.find((c) => c.label === e.target.value);
              if (preset) setBody(preset.body);
              setCannedValue('');
            }}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-muted focus:border-teal focus:outline-none disabled:opacity-50"
          >
            <option value="">{t('support.thread.cannedReplyPlaceholder')}</option>
            {cannedReplies.map((c) => (
              <option key={c.id} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={pending}
          rows={3}
          placeholder={isInternalNote ? t('support.thread.internalPlaceholder') : t('support.thread.customerPlaceholder')}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={isInternalNote}
              disabled={pending}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-warning"
            />
            {t('support.thread.internalNoteCheckbox')}
          </label>
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={submit}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {isInternalNote ? t('support.thread.addNote') : t('support.thread.sendReply')}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
