'use client';

/**
 * MaritalStatusFilterToggle — lets users include/exclude divorcees and widows
 * from their match feed.
 *
 * Saves changes immediately via PUT /api/v1/profiles/me/preferences using
 * a Server Action (CLAUDE.md rule 3).
 *
 * The component is additive — it only sets the `maritalStatus` preference
 * array; all other preferences remain untouched.
 */

import { useState, useTransition } from 'react';
import { updateMaritalPreferences } from '@/app/(app)/feed/actions';

type MaritalStatusValue = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface MaritalStatusFilterToggleProps {
  /** The user's current preferredMaritalStatuses (from their stored prefs). */
  initialPrefs?: MaritalStatusValue[];
}

export function MaritalStatusFilterToggle({
  initialPrefs = [],
}: MaritalStatusFilterToggleProps) {
  const [includeDivorcees, setIncludeDivorcees] = useState(
    initialPrefs.includes('DIVORCED') || initialPrefs.includes('SEPARATED'),
  );
  const [includeWidows, setIncludeWidows] = useState(
    initialPrefs.includes('WIDOWED'),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function buildPrefs(divorced: boolean, widowed: boolean): MaritalStatusValue[] {
    const prefs: MaritalStatusValue[] = ['NEVER_MARRIED'];
    if (divorced) {
      prefs.push('DIVORCED');
      prefs.push('SEPARATED');
    }
    if (widowed) prefs.push('WIDOWED');
    return prefs;
  }

  function handleToggle(type: 'divorced' | 'widowed', next: boolean) {
    const newDivorcees = type === 'divorced' ? next : includeDivorcees;
    const newWidows    = type === 'widowed'  ? next : includeWidows;

    if (type === 'divorced') setIncludeDivorcees(next);
    else setIncludeWidows(next);

    setError(null);
    startTransition(async () => {
      const result = await updateMaritalPreferences(buildPrefs(newDivorcees, newWidows));
      if (!result.success) {
        // Revert optimistic update
        if (type === 'divorced') setIncludeDivorcees(!next);
        else setIncludeWidows(!next);
        setError(result.error ?? 'Could not save preference');
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Marital Status
      </p>

      {/* Divorcees toggle */}
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Include divorcees</p>
          <p className="text-xs text-muted-foreground">
            Show profiles of people who are divorced or separated
          </p>
        </div>
        <button
          role="switch"
          aria-checked={includeDivorcees}
          aria-label="Include divorcees in match feed"
          disabled={isPending}
          onClick={() => handleToggle('divorced', !includeDivorcees)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            includeDivorcees ? 'bg-teal' : 'bg-border',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
              'transform transition duration-200',
              includeDivorcees ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </label>

      {/* Widows/widowers toggle */}
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Include widows / widowers</p>
          <p className="text-xs text-muted-foreground">
            Show profiles of people who have lost a spouse
          </p>
        </div>
        <button
          role="switch"
          aria-checked={includeWidows}
          aria-label="Include widows and widowers in match feed"
          disabled={isPending}
          onClick={() => handleToggle('widowed', !includeWidows)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            includeWidows ? 'bg-teal' : 'bg-border',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
              'transform transition duration-200',
              includeWidows ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </label>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {isPending ? (
        <p className="text-xs text-muted-foreground">Saving preference…</p>
      ) : null}
    </div>
  );
}
