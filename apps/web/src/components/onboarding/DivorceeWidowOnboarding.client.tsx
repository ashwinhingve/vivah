'use client';

/**
 * DivorceeWidowOnboarding — confidence-building journey for divorcees and
 * widows. Shown once when a user with DIVORCED or WIDOWED marital status
 * enters the platform for the first time.
 *
 * Privacy guarantee: the user's status is NEVER disclosed to other profiles
 * without their explicit consent. This component explains that upfront.
 */

import { useState, useTransition } from 'react';
import { Link } from '@/i18n/navigation';
import { Heart, ShieldCheck, Eye, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markDivorceeOnboardingDone } from '@/app/[locale]/(onboarding)/divorcee-widow/actions';

interface DivorceeWidowOnboardingProps {
  /** Whether the user is WIDOWED (true) or DIVORCED / SEPARATED (false) */
  isWidowed: boolean;
}

export function DivorceeWidowOnboarding({ isWidowed }: DivorceeWidowOnboardingProps) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const headline = isWidowed
    ? 'You deserve love again'
    : 'A new beginning starts here';

  const subline = isWidowed
    ? 'Many people find deep, lasting connection after loss. Your journey is valid, and you are not alone.'
    : 'Many people find love again after divorce. Smart Shaadi is a safe, judgement-free space for second chances.';

  function handleContinue() {
    startTransition(async () => {
      setError(null);
      const result = await markDivorceeOnboardingDone(notes.trim() || undefined);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
    });
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
          <Heart className="h-8 w-8 text-teal" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-primary">
          Welcome to Smart Shaadi
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your profile is ready. Head to your feed to start discovering compatible matches.
        </p>
        <Button asChild className="mt-2 min-h-[44px]">
          <Link href="/feed">
            Go to My Matches
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Heart className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-primary">{headline}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{subline}</p>
      </div>

      {/* Privacy guarantee cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Your status is private</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your marital history is never shared without your explicit consent. Other users
              see only what you choose to reveal.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Only compatible matches</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We only surface profiles that are genuinely open to connecting with someone in your
              situation — no unwanted mismatches.
            </p>
          </div>
        </div>
      </div>

      {/* Optional context note */}
      <div>
        <label
          htmlFor="divorcee-notes"
          className="block text-sm font-medium text-foreground"
        >
          Anything you&apos;d like us to know? <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          This is for your own record — it helps us personalise your experience and is not
          visible to other users.
        </p>
        <textarea
          id="divorcee-notes"
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2 w-full resize-none rounded-lg border border-border px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal"
          placeholder="e.g. I have children from my previous marriage. I'm looking for a supportive partner…"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {notes.length}/500
        </p>
      </div>

      {/* Error */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {/* CTA */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleContinue}
          disabled={isPending}
          className="min-h-[44px] px-8"
        >
          {isPending ? 'Saving…' : 'Continue to My Matches'}
          {!isPending && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
