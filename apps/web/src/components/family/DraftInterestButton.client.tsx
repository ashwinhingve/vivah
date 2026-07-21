'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Heart, CheckCircle2 } from 'lucide-react';
import { draftFamilyInterestAction } from '@/app/[locale]/(app)/family/actions';

interface Props {
  childUserId: string;
  targetProfileId: string;
  candidateName: string;
}

/**
 * Guardian co-pilot: drafts a SEND_INTEREST for the seeker to approve.
 * The interest is never sent directly — the seeker confirms it from their inbox.
 */
export function DraftInterestButton({ childUserId, targetProfileId, candidateName }: Props) {
  const t = useTranslations('family.components.draftInterestButton');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs font-medium text-success">
        <CheckCircle2 className="h-4 w-4" /> {t('drafted')}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await draftFamilyInterestAction({ childUserId, targetProfileId });
            if (!r.ok) setError(r.error ?? t('draftFailed'));
            else setDone(true);
          });
        }}
        aria-label={`Draft interest in ${candidateName}`}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        <Heart className="h-4 w-4" /> {pending ? t('drafting') : t('draftInterest')}
      </button>
      {error && <p className="mt-1 text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
