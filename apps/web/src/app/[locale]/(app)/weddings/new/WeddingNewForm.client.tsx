'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { createWeddingAction, type CreateWeddingState } from './actions';

const initialState: CreateWeddingState = { status: 'idle' };

function SubmitButton() {
  const t = useTranslations('weddings.new.form');
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full min-h-[44px] rounded-lg py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 bg-teal"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('creating')}
        </>
      ) : (
        t('submit')
      )}
    </button>
  );
}

export function WeddingNewForm() {
  const t = useTranslations('weddings.new.form');
  const [state, formAction] = useActionState(createWeddingAction, initialState);
  const today = new Date().toISOString().split('T')[0];

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {state.message || t('errorGeneric')}
        </div>
      )}

      <div>
        <label htmlFor="weddingName" className="block text-sm font-medium text-foreground mb-1.5">
          {t('weddingName')}
        </label>
        <input
          id="weddingName"
          name="weddingName"
          type="text"
          placeholder={t('weddingNamePlaceholder')}
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t('weddingNameHelp')}</p>
      </div>

      <div>
        <label htmlFor="weddingDate" className="block text-sm font-medium text-foreground mb-1.5">
          {t('weddingDate')}
        </label>
        <input
          id="weddingDate"
          name="weddingDate"
          type="date"
          min={today}
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t('weddingDateHelp')}</p>
      </div>

      <div>
        <label htmlFor="venueName" className="block text-sm font-medium text-foreground mb-1.5">
          {t('venueName')}
        </label>
        <input
          id="venueName"
          name="venueName"
          type="text"
          placeholder={t('venuePlaceholder')}
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
      </div>

      <div>
        <label htmlFor="venueCity" className="block text-sm font-medium text-foreground mb-1.5">
          {t('venueCity')}
        </label>
        <input
          id="venueCity"
          name="venueCity"
          type="text"
          placeholder={t('venueCityPlaceholder')}
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
      </div>

      <div>
        <label htmlFor="venueAddress" className="block text-sm font-medium text-foreground mb-1.5">
          {t('venueAddress')} <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="venueAddress"
          name="venueAddress"
          type="text"
          placeholder="e.g. 12 MG Road, near City Mall"
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
      </div>

      <div>
        <label htmlFor="budgetTotal" className="block text-sm font-medium text-foreground mb-1.5">
          Total Budget (₹)
        </label>
        <input
          id="budgetTotal"
          name="budgetTotal"
          type="number"
          min="0"
          step="1000"
          placeholder="e.g. 2000000"
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
