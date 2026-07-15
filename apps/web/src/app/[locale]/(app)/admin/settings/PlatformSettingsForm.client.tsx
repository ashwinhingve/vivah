'use client';

import { useState, useTransition } from 'react';

// Web and API are separate origins in prod (smartshaadi.co.in ↔
// api.smartshaadi.co.in) with no Next rewrites — a relative fetch 404s. Prefix
// the API origin like every other admin client component.
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  lgbtqEnabled:   boolean;
  lgbtqUpdatedAt: string | null;
}

export function PlatformSettingsForm({ lgbtqEnabled, lgbtqUpdatedAt }: Props) {
  const [enabled, setEnabled] = useState(lgbtqEnabled);
  const [updatedAt, setUpdatedAt] = useState(lgbtqUpdatedAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleLgbtq(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`${API_URL}/api/v1/admin/platform-settings/lgbtq_matching_enabled`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: next }),
        credentials: 'include',
      });
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      setEnabled(next);
      setUpdatedAt(new Date().toISOString());
    });
  }

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">
            LGBTQ+ Inclusive Matching
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When enabled, expanded gender identity options and same-gender matching
            become available. Affects all users. Default is off.
          </p>
          {updatedAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last changed: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle LGBTQ+ inclusive matching"
          disabled={pending}
          onClick={() => toggleLgbtq(!enabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border transition-colors ${
            enabled ? 'bg-primary' : 'bg-muted'
          } ${pending ? 'opacity-60' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
