'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { savePortfolioAction } from './actions';
import { EVENT_TYPE_VALUES, type EventTypeValue } from '@smartshaadi/schemas';

function label(v: string): string {
  return v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
}

interface Props {
  vendorId: string;
  about: string;
  awards: string[];
  certifications: string[];
  selectedEventTypes: EventTypeValue[];
}

export function PortfolioForm({ vendorId, about, awards, certifications, selectedEventTypes }: Props) {
  const [state, formAction, pending] = useActionState(savePortfolioAction, undefined);
  const selected = new Set<string>(selectedEventTypes);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium text-primary';

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <input type="hidden" name="vendorId" value={vendorId} />

      <div>
        <label htmlFor="about" className={labelCls}>About your work</label>
        <textarea id="about" name="about" rows={4} defaultValue={about} disabled={pending}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50"
          placeholder="Your style, experience, and what sets you apart." />
      </div>

      <div>
        <label htmlFor="awards" className={labelCls}>Awards</label>
        <input id="awards" name="awards" defaultValue={awards.join(', ')} disabled={pending} className={inputCls}
          placeholder="Comma-separated, e.g. Best Décor 2024, Editor's Pick" />
      </div>

      <div>
        <label htmlFor="certifications" className={labelCls}>Certifications</label>
        <input id="certifications" name="certifications" defaultValue={certifications.join(', ')} disabled={pending} className={inputCls}
          placeholder="Comma-separated, e.g. FSSAI, ISO 9001" />
      </div>

      <fieldset>
        <legend className={labelCls}>Event types you serve</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Selecting these makes you discoverable to event coordinators routing work.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EVENT_TYPE_VALUES.map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-gold/40"
            >
              <input type="checkbox" name="eventTypes" value={v} defaultChecked={selected.has(v)} disabled={pending}
                className="h-4 w-4 rounded border-border accent-teal" />
              <span className="text-primary">{label(v)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save & continue'} <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
