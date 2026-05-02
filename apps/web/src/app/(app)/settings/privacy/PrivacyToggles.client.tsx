'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, Shield, Sparkles, Lock, ShieldX } from 'lucide-react';
import { Card } from '@/components/ui/card';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type AllowMessageFrom = 'EVERYONE' | 'VERIFIED_ONLY' | 'SAME_COMMUNITY' | 'ACCEPTED_ONLY';
type PrivacyPreset   = 'CONSERVATIVE' | 'BALANCED' | 'OPEN';

interface SafetyMode {
  contactHidden?:        boolean;
  photoHidden?:          boolean;
  incognito?:            boolean;
  showLastActive?:       boolean;
  showReadReceipts?:     boolean;
  photoBlurUntilUnlock?: boolean;
  hideFromSearch?:       boolean;
  allowMessageFrom?:     AllowMessageFrom;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const PRESETS: { id: PrivacyPreset; label: string; tagline: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'CONSERVATIVE', label: 'Conservative', tagline: 'Maximum privacy. Verified-only contact.',     icon: Lock },
  { id: 'BALANCED',     label: 'Balanced',     tagline: 'Recommended. Some visibility, contact gated.', icon: Shield },
  { id: 'OPEN',         label: 'Open',         tagline: 'Maximum reach. Everything visible.',           icon: Sparkles },
];

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
    photoHidden:          initial.photoHidden          ?? false,
    contactHidden:        initial.contactHidden        ?? true,
    incognito:            initial.incognito            ?? false,
    showLastActive:       initial.showLastActive       ?? true,
    showReadReceipts:     initial.showReadReceipts     ?? true,
    photoBlurUntilUnlock: initial.photoBlurUntilUnlock ?? false,
    hideFromSearch:       initial.hideFromSearch       ?? false,
    allowMessageFrom:     initial.allowMessageFrom     ?? 'EVERYONE',
  });
  const [state, setState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function persist(next: SafetyMode) {
    setState('saving');
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/me/safety-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
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

  async function applyPreset(preset: PrivacyPreset) {
    setState('saving');
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/me/safety-mode/preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('preset failed');
      const body = (await res.json()) as { success: boolean; data: { safetyMode: SafetyMode } };
      setMode({ ...mode, ...body.data.safetyMode });
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setErrorMsg('Could not apply preset');
      setState('error');
    }
  }

  function update<K extends keyof SafetyMode>(key: K, next: SafetyMode[K]) {
    const updated = { ...mode, [key]: next };
    setMode(updated);
    void persist(updated);
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <p className="font-heading text-sm font-semibold text-primary mb-3">One-tap privacy presets</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                disabled={state === 'saving'}
                onClick={() => void applyPreset(p.id)}
                className="rounded-lg border border-border p-3 hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-50 min-h-[88px]"
              >
                <Icon className="h-4 w-4 text-primary mb-1.5" />
                <p className="text-xs font-semibold text-primary">{p.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{p.tagline}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <p className="font-heading text-sm font-semibold text-primary mb-1">Visibility</p>
        <div className="divide-y divide-border">
          <ToggleRow
            label="Photo hidden"
            description="Blur your photo on other people's feeds until you allow them to see it."
            checked={mode.photoHidden ?? false}
            onChange={(v) => update('photoHidden', v)}
            disabled={state === 'saving'}
          />
          <ToggleRow
            label="Contact hidden"
            description="Hide phone and email from matches until you accept them."
            checked={mode.contactHidden ?? true}
            onChange={(v) => update('contactHidden', v)}
            disabled={state === 'saving'}
          />
          <ToggleRow
            label="Incognito browsing"
            description="You see everyone; no one sees you in their feed or viewer list."
            checked={mode.incognito ?? false}
            onChange={(v) => update('incognito', v)}
            disabled={state === 'saving'}
          />
          <ToggleRow
            label="Hide from search"
            description="Keep your profile out of public discovery. You only appear to people you've already matched with."
            checked={mode.hideFromSearch ?? false}
            onChange={(v) => update('hideFromSearch', v)}
            disabled={state === 'saving'}
          />
          <ToggleRow
            label="Photo blur until unlock"
            description="Even after a match, your photo stays blurred until you tap to unblur it for them."
            checked={mode.photoBlurUntilUnlock ?? false}
            onChange={(v) => update('photoBlurUntilUnlock', v)}
            disabled={state === 'saving'}
          />
        </div>
      </Card>

      <Card className="p-4">
        <p className="font-heading text-sm font-semibold text-primary mb-1">Activity</p>
        <div className="divide-y divide-border">
          <ToggleRow
            label="Show last active"
            description="Let others see roughly when you were last on Smart Shaadi."
            checked={mode.showLastActive ?? true}
            onChange={(v) => update('showLastActive', v)}
            disabled={state === 'saving'}
          />
          <ToggleRow
            label="Read receipts"
            description="Show senders when you've seen their request or chat message."
            checked={mode.showReadReceipts ?? true}
            onChange={(v) => update('showReadReceipts', v)}
            disabled={state === 'saving'}
          />
        </div>
      </Card>

      <Card className="p-4">
        <p className="font-heading text-sm font-semibold text-primary mb-3">Who can send me requests</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: 'EVERYONE',        label: 'Everyone' },
            { v: 'VERIFIED_ONLY',   label: 'Verified only' },
            { v: 'SAME_COMMUNITY',  label: 'Same community' },
            { v: 'ACCEPTED_ONLY',   label: 'Already matched' },
          ] as const).map((opt) => {
            const selected = mode.allowMessageFrom === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                disabled={state === 'saving'}
                onClick={() => update('allowMessageFrom', opt.v as AllowMessageFrom)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <Link
          href="/settings/blocks"
          className="flex items-center justify-between gap-3 -m-2 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <ShieldX className="h-4 w-4 text-rose-600" />
            <div>
              <p className="text-sm font-semibold text-primary">Blocked profiles</p>
              <p className="text-xs text-muted-foreground">Review who you've blocked and unblock if you change your mind.</p>
            </div>
          </div>
          <span className="text-muted-foreground">›</span>
        </Link>
      </Card>

      <div aria-live="polite" className="flex h-5 items-center justify-end gap-1.5 text-xs">
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
    </div>
  );
}
