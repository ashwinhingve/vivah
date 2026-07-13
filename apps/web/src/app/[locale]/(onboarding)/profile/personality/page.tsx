'use client';

import { useActionState, useEffect, useState, type JSX } from 'react';
import { Link } from '@/i18n/navigation';
import { useFormStatus } from 'react-dom';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { updatePersonality } from '../actions';

interface PersonalityState {
  introvertExtrovert: number;
  traditionalModern: number;
  plannerSpontaneous: number;
  religiousSecular: number;
  ambitiousBalanced: number;
  familyIndependent: number;
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// Personality is the profile-completeness refinement step; every core section
// precedes it, so the progress bar shows the full journey as done.
const STEPS = [
  { label: 'Personal',    done: true, active: false },
  { label: 'Family',      done: true, active: false },
  { label: 'Career',      done: true, active: false },
  { label: 'Lifestyle',   done: true, active: false },
  { label: 'Horoscope',   done: true, active: false },
  { label: 'Community',   done: true, active: false },
  { label: 'Preferences', done: true, active: false },
  { label: 'Photos',      done: true, active: false },
];

const AXES: Array<{ key: keyof PersonalityState; label: string; left: string; right: string }> = [
  { key: 'introvertExtrovert', label: 'Social energy',    left: 'Introvert',    right: 'Extrovert' },
  { key: 'traditionalModern',  label: 'Outlook',          left: 'Traditional',  right: 'Modern' },
  { key: 'plannerSpontaneous', label: 'Decision style',   left: 'Planner',      right: 'Spontaneous' },
  { key: 'religiousSecular',   label: 'Religiousness',    left: 'Religious',    right: 'Secular' },
  { key: 'ambitiousBalanced',  label: 'Career drive',     left: 'Ambitious',    right: 'Balanced' },
  { key: 'familyIndependent',  label: 'Family closeness', left: 'Family-first', right: 'Independent' },
];

const DEFAULTS: PersonalityState = {
  introvertExtrovert: 4,
  traditionalModern: 4,
  plannerSpontaneous: 4,
  religiousSecular: 4,
  ambitiousBalanced: 4,
  familyIndependent: 4,
};

function isPersonalityState(value: unknown): value is Partial<PersonalityState> {
  return typeof value === 'object' && value !== null;
}

function SaveButton(): JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="ml-auto min-h-[44px] px-6 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export default function PersonalityPage(): JSX.Element {
  const [state, formAction] = useActionState(updatePersonality, undefined);
  const [vals, setVals] = useState<PersonalityState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/profiles/me`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data?: { personality?: unknown } };
          if (!cancelled && json.success && isPersonalityState(json.data?.personality)) {
            setVals((v) => ({ ...v, ...(json.data!.personality as Partial<PersonalityState>) }));
          }
        }
      } catch {
        // Keep DEFAULTS — server roundtrip not critical for first paint.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-surface rounded-2xl shadow-card border border-gold/20 p-6">
        <h1 className="text-lg font-semibold text-primary font-heading mb-1">Personality</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Six quick sliders. Helps us surface people who genuinely fit you.
        </p>

        <form key={loaded ? 'ready' : 'loading'} action={formAction} className="space-y-6">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {state?.ok && (
            <div role="status" className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
              Saved. Your personality is up to date.
            </div>
          )}

          {AXES.map((axis) => (
            <div key={axis.key} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">{axis.label}</span>
                <span className="text-xs text-muted-foreground">{vals[axis.key]}/7</span>
              </div>
              <input
                type="range"
                name={axis.key}
                min={1}
                max={7}
                step={1}
                value={vals[axis.key]}
                onChange={(e) => setVals((v) => ({ ...v, [axis.key]: Number(e.target.value) }))}
                className="w-full accent-teal"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{axis.left}</span>
                <span>{axis.right}</span>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors min-h-[44px] inline-flex items-center"
            >
              ← Back
            </Link>
            <SaveButton />
          </div>
        </form>
      </div>
    </div>
  );
}
