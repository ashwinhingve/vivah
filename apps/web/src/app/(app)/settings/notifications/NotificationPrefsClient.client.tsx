'use client';

import { useState, useTransition } from 'react';

interface Prefs {
  push:       boolean;
  sms:        boolean;
  email:      boolean;
  inApp:      boolean;
  marketing:  boolean;
  mutedTypes: string[];
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const CHANNELS: Array<{ key: keyof Prefs; label: string; description: string }> = [
  { key: 'push',      label: 'Push notifications', description: 'Real-time alerts on your phone or browser' },
  { key: 'email',     label: 'Email',              description: 'Transactional and digest emails' },
  { key: 'sms',       label: 'SMS',                description: 'Critical alerts via text message' },
  { key: 'inApp',     label: 'In-app',             description: 'Bell icon notifications inside Smart Shaadi' },
  { key: 'marketing', label: 'Marketing',          description: 'Tips, success stories, occasional offers' },
];

const MUTABLE_EVENTS = [
  { key: 'NEW_CHAT_MESSAGE',       label: 'New chat messages' },
  { key: 'MATCH_REQUEST_RECEIVED', label: 'Match request received' },
  { key: 'MATCH_REQUEST_ACCEPTED', label: 'Match request accepted' },
  { key: 'MEETING_INVITE',         label: 'Video meeting invites' },
  { key: 'MEETING_REMINDER',       label: 'Meeting reminders' },
  { key: 'BOOKING_CONFIRMED',      label: 'Booking confirmations' },
];

export function NotificationPrefsClient({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function update(patch: Partial<Prefs>): void {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaved(false);
    startTransition(async () => {
      try {
        await fetch(`${API_URL}/api/v1/users/me/notification-preferences`, {
          method:      'PUT',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(next),
        });
        setSaved(true);
      } catch {
        /* noop */
      }
    });
  }

  function toggleMuted(type: string): void {
    const exists = prefs.mutedTypes.includes(type);
    const mutedTypes = exists ? prefs.mutedTypes.filter(t => t !== type) : [...prefs.mutedTypes, type];
    update({ mutedTypes });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-[#0A1F4D]">Channels</h2>
        <p className="mb-4 text-sm text-muted-foreground">Choose how you want to be notified.</p>
        <div className="divide-y divide-slate-100">
          {CHANNELS.map(c => (
            <label key={c.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <span className="block font-medium text-[#0A1F4D]">{c.label}</span>
                <span className="block text-sm text-muted-foreground">{c.description}</span>
              </div>
              <input
                type="checkbox"
                checked={prefs[c.key] as boolean}
                onChange={(e) => update({ [c.key]: e.currentTarget.checked } as Partial<Prefs>)}
                className="h-5 w-5 accent-[#1848C8]"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-[#0A1F4D]">Mute specific events</h2>
        <p className="mb-4 text-sm text-muted-foreground">Even with channels enabled, these specific events will not notify you.</p>
        <div className="divide-y divide-slate-100">
          {MUTABLE_EVENTS.map(e => {
            const muted = prefs.mutedTypes.includes(e.key);
            return (
              <label key={e.key} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[#0A1F4D]">{e.label}</span>
                <input
                  type="checkbox"
                  checked={muted}
                  onChange={() => toggleMuted(e.key)}
                  aria-label={`Mute ${e.label}`}
                  className="h-5 w-5 accent-red-500"
                />
              </label>
            );
          })}
        </div>
      </section>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending ? 'Saving…' : saved ? 'Saved.' : ' '}
      </p>
    </div>
  );
}
