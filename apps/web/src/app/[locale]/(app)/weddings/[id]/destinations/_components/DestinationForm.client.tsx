'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { WeddingDestination } from '@smartshaadi/types';
import { createDestinationAction, updateDestinationAction } from '../actions';

/**
 * Create a destination leg (Phase 8 Unit 8.1).
 *
 * Uncontrolled — the Server Action reads FormData directly, so there is no
 * per-keystroke state to keep in sync. Native date inputs follow the pattern in
 * components/rental/DateRangePicker.client.tsx rather than pulling in a picker
 * library.
 *
 * The window check here is a courtesy so the planner is not round-tripped for an
 * obvious mistake. It is NOT the guarantee: the Zod schema and the
 * `destinations_date_window_ck` CHECK constraint both re-reject it server-side.
 */
interface Props {
  weddingId: string;
  /**
   * Present when editing an existing leg; absent when creating one. The same
   * fields are collected either way, so one form serves both rather than a
   * near-duplicate edit component drifting from this one.
   */
  destination?: WeddingDestination;
  labels: {
    city: string; cityPlaceholder: string;
    countryCode: string; timezone: string;
    arriveOn: string; departOn: string;
    notes: string; notesPlaceholder: string;
    makePrimary: string; makePrimaryHint: string;
    submit: string; submitting: string; cancel: string;
    windowError: string;
  };
}

export function DestinationForm({ weddingId, destination, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [arriveOn, setArriveOn] = useState(destination?.arriveOn ?? '');
  const [departOn, setDepartOn] = useState(destination?.departOn ?? '');

  const windowInvalid = arriveOn !== '' && departOn !== '' && departOn < arriveOn;

  function onSubmit(formData: FormData) {
    setError(null);
    if (windowInvalid) {
      setError(labels.windowError);
      return;
    }
    startTransition(async () => {
      const res = destination
        ? await updateDestinationAction(weddingId, destination.id, formData)
        : await createDestinationAction(weddingId, formData);
      if (!res.ok) {
        setError(res.error ?? 'Could not save this destination.');
        return;
      }
      router.push(
        destination
          ? `/weddings/${weddingId}/destinations/${destination.id}`
          : `/weddings/${weddingId}/destinations`,
      );
    });
  }

  const field = 'h-11 w-full rounded-lg border border-gold/30 bg-surface px-3 text-sm text-primary placeholder:text-muted-foreground focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal';
  const label = 'mb-1.5 block text-sm font-medium text-primary';

  return (
    <form action={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="city" className={label}>{labels.city}</label>
        <input
          id="city" name="city" required maxLength={100}
          defaultValue={destination?.city ?? ''}
          placeholder={labels.cityPlaceholder} className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="countryCode" className={label}>{labels.countryCode}</label>
          <input
            id="countryCode" name="countryCode" maxLength={2}
            defaultValue={destination?.countryCode ?? 'IN'}
            className={`${field} uppercase`}
          />
        </div>
        <div>
          <label htmlFor="ianaTimezone" className={label}>{labels.timezone}</label>
          <input
            id="ianaTimezone" name="ianaTimezone" maxLength={64}
            defaultValue={destination?.ianaTimezone ?? 'Asia/Kolkata'} className={field}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="arriveOn" className={label}>{labels.arriveOn}</label>
          <input
            id="arriveOn" name="arriveOn" type="date" required
            value={arriveOn} onChange={(e) => setArriveOn(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="departOn" className={label}>{labels.departOn}</label>
          <input
            id="departOn" name="departOn" type="date" required
            value={departOn} onChange={(e) => setDepartOn(e.target.value)}
            className={field}
            aria-invalid={windowInvalid}
          />
        </div>
      </div>

      {windowInvalid && (
        <p role="alert" className="text-sm text-destructive">{labels.windowError}</p>
      )}

      <div>
        <label htmlFor="notes" className={label}>{labels.notes}</label>
        <textarea
          id="notes" name="notes" rows={3} maxLength={2000}
          defaultValue={destination?.notes ?? ''}
          placeholder={labels.notesPlaceholder}
          className="w-full rounded-lg border border-gold/30 bg-surface p-3 text-sm text-primary placeholder:text-muted-foreground focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
      </div>

      {!destination && (
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox" name="isPrimary"
          className="mt-1 h-4 w-4 rounded border-gold/40 text-teal focus:ring-teal"
        />
        <span>
          <span className="block text-sm font-medium text-primary">{labels.makePrimary}</span>
          <span className="block text-xs text-muted-foreground">{labels.makePrimaryHint}</span>
        </span>
      </label>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gold/20 pt-4 sm:flex-row-reverse">
        <button
          type="submit" disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-teal px-5 text-sm font-medium text-background transition-colors hover:bg-teal/90 disabled:opacity-60"
        >
          {pending ? labels.submitting : labels.submit}
        </button>
        <button
          type="button" onClick={() => router.back()} disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-gold/30 px-5 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
