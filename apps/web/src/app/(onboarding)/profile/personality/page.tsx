'use client';

import { useState, useTransition, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { savePersonalityAction } from '../actions';

interface PersonalityState {
  introvertExtrovert: number;
  traditionalModern: number;
  plannerSpontaneous: number;
  religiousSecular: number;
  ambitiousBalanced: number;
  familyIndependent: number;
}

const AXES: Array<{ key: keyof PersonalityState; label: string; left: string; right: string }> = [
  { key: 'introvertExtrovert', label: 'Social energy',     left: 'Introvert',    right: 'Extrovert' },
  { key: 'traditionalModern',  label: 'Outlook',           left: 'Traditional',  right: 'Modern' },
  { key: 'plannerSpontaneous', label: 'Decision style',    left: 'Planner',      right: 'Spontaneous' },
  { key: 'religiousSecular',   label: 'Religiousness',     left: 'Religious',    right: 'Secular' },
  { key: 'ambitiousBalanced',  label: 'Career drive',      left: 'Ambitious',    right: 'Balanced' },
  { key: 'familyIndependent',  label: 'Family closeness',  left: 'Family-first', right: 'Independent' },
];

const DEFAULTS: PersonalityState = {
  introvertExtrovert: 4,
  traditionalModern: 4,
  plannerSpontaneous: 4,
  religiousSecular: 4,
  ambitiousBalanced: 4,
  familyIndependent: 4,
};

export default function PersonalityPage(): JSX.Element {
  const router = useRouter();
  const [vals, setVals] = useState<PersonalityState>(DEFAULTS);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md p-5 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary">Tell us about yourself</h1>
        <p className="text-sm text-muted-foreground">
          Six quick sliders. Helps us find people who fit you.
        </p>
      </header>

      {AXES.map((axis) => (
        <div key={axis.key} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-foreground">{axis.label}</span>
            <span className="text-xs text-muted-foreground">{vals[axis.key]}/7</span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            value={vals[axis.key]}
            onChange={(e) =>
              setVals((v) => ({ ...v, [axis.key]: Number(e.target.value) }))
            }
            className="w-full accent-[#1848C8]"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{axis.left}</span>
            <span>{axis.right}</span>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await savePersonalityAction(vals);
            if (!r.ok) {
              setError(r.error ?? 'Save failed');
              return;
            }
            router.push('/profile/preferences');
          })
        }
        className="w-full rounded-lg bg-teal py-3 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Continue'}
      </button>

      <button
        type="button"
        onClick={() => router.push('/profile/preferences')}
        className="w-full text-sm text-muted-foreground underline"
      >
        Skip for now
      </button>
    </div>
  );
}
