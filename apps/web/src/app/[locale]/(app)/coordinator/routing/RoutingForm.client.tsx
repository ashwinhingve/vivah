'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import type { VendorProfile } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { VendorCard } from '@/components/vendor/VendorCard';
import { submitVendorRouting } from './actions';

// Mirrors VENDOR_EVENT_TYPES in @/lib/coordinator-api (which mirrors
// EVENT_TYPE_VALUES in apps/api/src/routes/vendorEngine.ts) — keep in sync.
// Declared locally rather than imported so this client bundle never pulls in
// coordinator-api.ts's server-only cookies()/fetch machinery.
const EVENT_TYPES = [
  'WEDDING', 'CORPORATE', 'FESTIVAL', 'COMMUNITY_EVENT', 'COMMUNITY',
  'GOVERNMENT', 'SCHOOL', 'OTHER', 'HALDI', 'MEHNDI', 'SANGEET',
  'ENGAGEMENT', 'RECEPTION',
] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface RankedVendor {
  vendor: VendorProfile;
  score: number;
  reasons: string[];
  estimatedCapacityPct: number;
}

const REASON_LABELS: Record<string, string> = {
  base_available: 'Available',
  event_type_enabled: 'Handles this event type',
  event_type_unconfigured: 'Event type not configured',
  city_match: 'City match',
  state_match: 'State match',
};

function humanizeReason(reason: string): string {
  const [key, count] = reason.split(':');
  if (key === 'same_week_bookings') {
    const n = Number(count) || 0;
    return `${n} other booking${n === 1 ? '' : 's'} that week`;
  }
  return REASON_LABELS[key ?? reason] ?? reason.replace(/_/g, ' ');
}

export function RoutingForm() {
  const [eventType, setEventType] = useState<EventType>('WEDDING');
  const [eventDate, setEventDate] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [results, setResults] = useState<RankedVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventDate) {
      setError('Pick an event date.');
      return;
    }

    const trimmedCity = city.trim();
    const trimmedState = state.trim();

    startTransition(async () => {
      const result = await submitVendorRouting({
        eventType,
        eventDate,
        ...(trimmedCity ? { city: trimmedCity } : {}),
        ...(trimmedState ? { state: trimmedState } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.vendors);
    });
  }

  return (
    <div>
      <form
        onSubmit={submit}
        className="grid grid-cols-1 gap-4 rounded-xl border border-gold/20 bg-surface p-5 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="r-type">Event type</Label>
          <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
            <SelectTrigger id="r-type">
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-date">Event date</Label>
          <Input
            id="r-date"
            type="date"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-city">City</Label>
          <Input
            id="r-city"
            placeholder="Optional"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-state">State</Label>
          <Input
            id="r-state"
            placeholder="Optional"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          {error ? (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending}>
            <Search aria-hidden="true" />
            Find vendors
          </Button>
        </div>
      </form>

      {results !== null && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {results.length} vendor{results.length === 1 ? '' : 's'} ranked
          </h2>

          {results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No routable vendors found"
              description="No active vendors are configured for this event type, date, and location. Try widening the location or picking a different date."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <div key={r.vendor.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-semibold text-teal">
                      Match {r.score}/100
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.estimatedCapacityPct}% booked that week
                    </span>
                  </div>
                  <VendorCard vendor={r.vendor} />
                  {r.reasons.length > 0 && (
                    <p className="px-1 text-[11px] text-muted-foreground">
                      {r.reasons.map(humanizeReason).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
