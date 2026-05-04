'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { createWeddingAction, type CreateWeddingState } from './actions';

const initialState: CreateWeddingState = { status: 'idle' };

function SubmitButton() {
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
          Creating…
        </>
      ) : (
        'Create Wedding Plan'
      )}
    </button>
  );
}

export function WeddingNewForm() {
  const [state, formAction] = useActionState(createWeddingAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="weddingDate" className="block text-sm font-medium text-foreground mb-1.5">
          Wedding Date
        </label>
        <input
          id="weddingDate"
          name="weddingDate"
          type="date"
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
      </div>

      <div>
        <label htmlFor="venueName" className="block text-sm font-medium text-foreground mb-1.5">
          Venue Name
        </label>
        <input
          id="venueName"
          name="venueName"
          type="text"
          placeholder="e.g. The Grand Palace Banquet"
          className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
        />
      </div>

      <div>
        <label htmlFor="venueCity" className="block text-sm font-medium text-foreground mb-1.5">
          City
        </label>
        <input
          id="venueCity"
          name="venueCity"
          type="text"
          placeholder="e.g. Mumbai"
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
