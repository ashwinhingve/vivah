'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

export default function PostMarriageError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('postMarriage.error');
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" aria-hidden="true" />
        <h1 className="mt-4 font-heading text-2xl text-primary">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('body')}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-surface transition hover:opacity-90"
        >
          {t('retry')}
        </button>
      </main>
    </div>
  );
}
