'use client';

import { useState } from 'react';

interface Props {
  slug: string;
  apiBase: string;
}

const STATUSES: Array<{ value: 'YES' | 'NO' | 'MAYBE'; label: string }> = [
  { value: 'YES', label: 'Joyfully accept' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NO', label: 'Regretfully decline' },
];

export function RsvpForm({ slug, apiBase }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState<'YES' | 'NO' | 'MAYBE'>('YES');
  const [plusOnes, setPlusOnes] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/invites/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          attending,
          plusOnes,
          message: message.trim() || undefined,
        }),
      });
      setSubmitting(false);
      if (res.ok) {
        setDone(true);
        return;
      }
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? 'Could not submit RSVP. Please try again.');
    } catch {
      setSubmitting(false);
      setError('Network error. Please try again.');
    }
  }

  if (done) {
    return (
      <p className="text-center text-success font-medium py-4">
        Thank you! Your RSVP has been recorded. 🎉
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="rsvp-name" className="block text-sm font-medium text-foreground mb-1">
          Your name
        </label>
        <input
          id="rsvp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
        />
      </div>

      <div>
        <label htmlFor="rsvp-phone" className="block text-sm font-medium text-foreground mb-1">
          Phone (optional)
        </label>
        <input
          id="rsvp-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          maxLength={15}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-foreground mb-2">Will you attend?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setAttending(s.value)}
              aria-pressed={attending === s.value}
              className={`h-11 rounded-lg border px-3 text-sm ${
                attending === s.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      {attending !== 'NO' && (
        <div>
          <label htmlFor="rsvp-plus" className="block text-sm font-medium text-foreground mb-1">
            Guests joining you
          </label>
          <input
            id="rsvp-plus"
            type="number"
            min={0}
            max={20}
            value={plusOnes}
            onChange={(e) => setPlusOnes(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
          />
        </div>
      )}

      <div>
        <label htmlFor="rsvp-msg" className="block text-sm font-medium text-foreground mb-1">
          Message for the couple (optional)
        </label>
        <textarea
          id="rsvp-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-lg bg-primary px-5 text-surface disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Send RSVP'}
      </button>
    </form>
  );
}
