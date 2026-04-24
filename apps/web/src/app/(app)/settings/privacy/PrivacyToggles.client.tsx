'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface SafetyMode {
  photoHidden?:   boolean;
  contactHidden?: boolean;
  incognito?:     boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ToggleRowProps {
  label:       string;
  description: string;
  checked:     boolean;
  onChange:    (next: boolean) => void;
  disabled?:   boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <p className="font-heading text-sm font-semibold text-primary">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
          checked ? 'bg-teal' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function PrivacyToggles({ initial }: { initial: SafetyMode }) {
  const [mode, setMode] = useState<SafetyMode>({
    photoHidden:   initial.photoHidden   ?? false,
    contactHidden: initial.contactHidden ?? true,  // default true per safety.service
    incognito:     initial.incognito     ?? false,
  });
  const [state, setState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function persist(next: SafetyMode) {
    setState('saving');
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/me/safety-mode`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(next),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(body.error ?? 'Could not save settings');
        setState('error');
        return;
      }
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setErrorMsg('Network error — please try again');
      setState('error');
    }
  }

  function onChange<K extends keyof SafetyMode>(key: K, next: boolean) {
    const updated = { ...mode, [key]: next };
    setMode(updated);
    void persist(updated);
  }

  return (
    <Card className="p-4">
      <div className="divide-y divide-border">
        <ToggleRow
          label="Photo hidden"
          description="Blur your photo on other people's feeds until you allow them to see it."
          checked={mode.photoHidden ?? false}
          onChange={(v) => onChange('photoHidden', v)}
          disabled={state === 'saving'}
        />
        <ToggleRow
          label="Contact hidden"
          description="Hide phone and email from matches until you accept them."
          checked={mode.contactHidden ?? true}
          onChange={(v) => onChange('contactHidden', v)}
          disabled={state === 'saving'}
        />
        <ToggleRow
          label="Incognito browsing"
          description="You see everyone; no one sees you in their feed or viewer list."
          checked={mode.incognito ?? false}
          onChange={(v) => onChange('incognito', v)}
          disabled={state === 'saving'}
        />
      </div>

      <div aria-live="polite" className="mt-4 flex h-5 items-center justify-end gap-1.5 text-xs">
        {state === 'saving' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal" aria-hidden="true" />
            <span className="text-muted-foreground">Saving…</span>
          </>
        ) : state === 'saved' ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            <span className="text-success">Saved</span>
          </>
        ) : state === 'error' && errorMsg ? (
          <span className="text-destructive">{errorMsg}</span>
        ) : null}
      </div>
    </Card>
  );
}
