'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Send, MessageSquare } from 'lucide-react';
import { addTicketMessageAction } from '@/app/[locale]/(app)/support/actions';
import type { TicketMessageView } from '@/lib/support-api';
import { cn } from '@/lib/utils';

interface Props {
  ticketId: string;
  messages: TicketMessageView[];
  myUserId: string;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

export function TicketThread({ ticketId, messages, myUserId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="rounded-xl border border-gold/20 bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <MessageSquare className="h-4 w-4 text-teal" />
        <h2 className="font-heading text-lg text-primary">Conversation</h2>
        <span className="text-xs text-text-muted">({messages.length})</span>
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            No replies yet. Start the conversation below.
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
                    <Lock className="h-3 w-3" /> Internal note
                  </span>
                )}
                <span className="ml-auto">{formatWhen(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-text">{m.body}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border px-4 py-3 sm:px-6">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={pending}
          rows={3}
          placeholder={isInternalNote ? 'Add an internal note (staff-only)…' : 'Reply to the customer…'}
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
            Internal note (not visible to the customer)
          </label>
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={submit}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {isInternalNote ? 'Add note' : 'Send reply'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
