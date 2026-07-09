'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Reply, Send } from 'lucide-react';
import { replyToReviewAction } from '@/app/[locale]/(app)/vendor/reviews/actions';

export function VendorReviewReply({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline"
      >
        <Reply className="h-4 w-4" /> Reply
      </button>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        disabled={pending}
        rows={3}
        maxLength={2000}
        placeholder="Thank the reviewer or address their feedback…"
        className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !reply.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await replyToReviewAction(reviewId, reply);
              if (!r.ok) setError(r.error ?? 'Could not post your reply.');
              else {
                setOpen(false);
                setReply('');
                router.refresh();
              }
            });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> {pending ? 'Posting…' : 'Post reply'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => { setOpen(false); setError(null); }}
          className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
