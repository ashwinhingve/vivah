'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { createTicketAction } from '@/app/[locale]/(app)/support/actions';
import type { TicketCategory } from '@/lib/support-api';

const CATEGORIES: TicketCategory[] = [
  'ACCOUNT', 'PAYMENT', 'BOOKING', 'MATCH_ABUSE', 'KYC', 'VENDOR', 'TECHNICAL', 'OTHER',
];

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function NewTicketButton() {
  const t = useTranslations('support');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const subject = String(formData.get('subject') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const category = String(formData.get('category') ?? '');
    if (!subject) { setError(t('newTicketForm.subjectRequired')); return; }
    setError(null);
    startTransition(async () => {
      const r = await createTicketAction({ subject, description: description || undefined, category: category || undefined });
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> {t('newTicket')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-card-hover sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg text-primary">{t('newTicket')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-text-muted hover:text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action={submit} className="space-y-4">
              <div>
                <label htmlFor="subject" className="mb-1 block text-sm font-medium text-primary">{t('newTicketForm.subjectLabel')}</label>
                <input id="subject" name="subject" required disabled={pending}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
              </div>
              <div>
                <label htmlFor="category" className="mb-1 block text-sm font-medium text-primary">{t('columns.category')}</label>
                <select id="category" name="category" defaultValue="OTHER" disabled={pending}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="description" className="mb-1 block text-sm font-medium text-primary">{t('newTicketForm.descriptionLabel')}</label>
                <textarea id="description" name="description" rows={4} disabled={pending}
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={pending}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {pending ? t('newTicketForm.creating') : t('newTicketForm.submit')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
