'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { submitRating } from '@/lib/family-mode-api';

interface Props {
  subjectProfileId: string;
  candidateProfileId: string;
  initialScore?: number;
}

export function FamilyRatingForm({ subjectProfileId, candidateProfileId, initialScore }: Props) {
  const t = useTranslations('family.components.familyRatingForm');
  const [score, setScore] = useState<number>(initialScore ?? 70);
  const [notes, setNotes] = useState<string>('');
  const [concerns, setConcerns] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const concernsList = concerns
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const result = await submitRating({
        subject_profile_id: subjectProfileId,
        candidate_profile_id: candidateProfileId,
        overall_score: score,
        ...(concernsList.length ? { concerns: concernsList } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      if (!result) {
        setError(t('error'));
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
      <h3 className="text-base font-heading text-primary">{t('heading')}</h3>

      <label className="block">
        <span className="text-sm text-foreground">{t('overall')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full mt-2 accent-primary"
          disabled={isPending}
        />
        <span className="text-lg font-heading text-primary">{score}</span>
      </label>

      <label className="block">
        <span className="text-sm text-foreground">{t('concerns')}</span>
        <input
          type="text"
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          placeholder={t('concernsPlaceholder')}
          className="mt-1 w-full rounded-lg border border-gold/30 px-3 py-2 text-sm"
          disabled={isPending}
        />
      </label>

      <label className="block">
        <span className="text-sm text-foreground">{t('notes')}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-gold/30 px-3 py-2 text-sm"
          disabled={isPending}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-success">{t('success')}</p>}

      <button
        type="submit"
        className="rounded-lg bg-primary text-primary-foreground px-4 h-11 text-sm font-medium hover:opacity-95 disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
