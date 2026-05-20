'use client';

import { useState } from 'react';

const CEREMONY_OPTIONS: { value: string; label: string }[] = [
  { value: 'HALDI',      label: 'Haldi' },
  { value: 'MEHNDI',     label: 'Mehndi' },
  { value: 'SANGEET',    label: 'Sangeet' },
  { value: 'WEDDING',    label: 'Wedding' },
  { value: 'RECEPTION',  label: 'Reception' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'OTHER',      label: 'Other' },
];

interface CeremonyFormProps {
  /** Server action already bound to the wedding id. */
  action: (formData: FormData) => void;
}

/**
 * Add-ceremony form. Renders a free-text "Ceremony Name" field only when the
 * user picks the "Other" type (e.g. Manda, Dulhasar). The End Time field has
 * been removed — only a single start time is collected.
 */
export function CeremonyForm({ action }: CeremonyFormProps) {
  const [type, setType] = useState('HALDI');
  const today = new Date().toISOString().split('T')[0];
  const isOther = type === 'OTHER';

  return (
    <details className="group">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover min-h-[44px]">
        <span className="text-lg leading-none group-open:rotate-45 transition-transform">+</span>
        Add Ceremony
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select
              name="type"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CEREMONY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
            <input
              type="date"
              name="date"
              min={today}
              className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {isOther && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ceremony Name</label>
              <input
                type="text"
                name="customTypeName"
                required
                placeholder="e.g. Manda, Dulhasar, Sehrabandi, Tilak, Sagan, Pithi"
                className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter any traditional or family-specific ceremony name
              </p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Start Time</label>
            <input
              type="time"
              name="startTime"
              className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Venue</label>
          <input
            type="text"
            name="venue"
            placeholder="e.g. The Rooftop Garden"
            className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="submit"
          className="min-h-[44px] px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
        >
          Add Ceremony
        </button>
      </form>
    </details>
  );
}
