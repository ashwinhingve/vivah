'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Reply, Send } from 'lucide-react';
import { replyToReviewAction } from '@/app/[locale]/(app)/vendor/reviews/actions';

export function VendorReviewReply({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const t = useTranslations('vendorRole.reviews');
  const tCommon = useTranslations('common');
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
        <Reply className="h-4 w-4" /> {t('replyCta')}
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
        placeholder={t('replyPlaceholder')}
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
              if (!r.ok) setError(r.error ?? t('replyError'));
              else {
                setOpen(false);
                setReply('');
                router.refresh();
              }
            });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> {pending ? t('replyPosting') : t('replyPost')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => { setOpen(false); setError(null); }}
          className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
        >
          {tCommon('cancel')}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
