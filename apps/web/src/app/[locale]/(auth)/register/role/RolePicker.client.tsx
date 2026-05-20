'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@smartshaadi/types';
import { setRoleAction } from '../../actions';

const ROLES: { value: UserRole; label: string; description: string; icon: string }[] = [
  {
    value: 'INDIVIDUAL',
    label: 'Individual',
    description: 'Looking for a life partner',
    icon: '👤',
  },
  {
    value: 'FAMILY_MEMBER',
    label: 'Family Member',
    description: 'Searching on behalf of family',
    icon: '👨‍👩‍👧',
  },
  {
    value: 'VENDOR',
    label: 'Vendor',
    description: 'Photographer, caterer, decorator & more',
    icon: '🏪',
  },
  {
    value: 'EVENT_COORDINATOR',
    label: 'Event Coordinator',
    description: 'Managing multiple wedding events',
    icon: '📋',
  },
];

export default function RolePicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    const result = await setRoleAction(selected);

    if (!result.success) {
      setError(result.error ?? 'Failed to set role. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="w-full max-w-sm bg-surface rounded-xl shadow-sm border border-gold/20 p-6 space-y-5">
      <div>
        <h2
          className="text-2xl font-semibold text-foreground font-heading"
        >
          I am a…
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Choose how you'll use Smart Shaadi</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ROLES.map((role) => {
          const isSelected = selected === role.value;
          return (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelected(role.value)}
              className={[
                'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-teal bg-teal/5 ring-2 ring-teal/20'
                  : 'border-gold/40 hover:border-gold/70 bg-surface',
              ].join(' ')}
            >
              <span className="text-2xl" role="img" aria-label={role.label}>
                {role.icon}
              </span>
              <span className={`text-sm font-semibold ${isSelected ? 'text-teal' : 'text-foreground'}`}>
                {role.label}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">{role.description}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={() => { void handleContinue(); }}
        disabled={!selected || loading}
        className="w-full min-h-[44px] rounded-lg bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-surface/30 border-t-white animate-spin" />
            Setting up your account…
          </>
        ) : (
          'Continue'
        )}
      </button>
    </div>
  );
}
