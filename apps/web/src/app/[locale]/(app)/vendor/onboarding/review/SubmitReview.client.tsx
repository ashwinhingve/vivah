'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, CheckCircle2 } from 'lucide-react';
import { submitForReviewAction } from './actions';

interface Props {
  canSubmit: boolean;
  alreadySubmitted: boolean;
}

export function SubmitReview({ canSubmit, alreadySubmitted }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadySubmitted) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Your profile has been submitted. We’ll email you once the review is complete.
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={!canSubmit || pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await submitForReviewAction();
            if (!r.ok) setError(r.error ?? 'Could not submit for review.');
            else router.push('/vendor-dashboard');
          });
        }}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {pending ? 'Submitting…' : 'Submit for review'}
      </button>
      {!canSubmit && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Add your business details and at least one service before submitting.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
