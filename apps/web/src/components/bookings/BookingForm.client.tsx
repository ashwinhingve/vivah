'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { AvailabilityCalendar } from '@/components/vendor/AvailabilityCalendar.client';
import type { VendorProfile } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const CEREMONY_TYPES = [
  'WEDDING','HALDI','MEHNDI','SANGEET','ENGAGEMENT','RECEPTION',
  'CORPORATE','FESTIVAL','COMMUNITY','OTHER',
] as const;

interface PackageOption {
  name:        string;
  price:       number;
  inclusions?: string[];
}

interface BookingFormProps {
  vendor:   VendorProfile;
  packages: PackageOption[];
}

interface AddonRow {
  id:        string;
  name:      string;
  quantity:  number;
  unitPrice: number;
}

function newAddon(): AddonRow {
  return {
    id:        Math.random().toString(36).slice(2),
    name:      '',
    quantity:  1,
    unitPrice: 0,
  };
}

export function BookingForm({ vendor, packages }: BookingFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [eventDate, setEventDate]     = useState<string>('');
  const [ceremonyType, setCeremony]   = useState<string>('WEDDING');
  const [serviceId, setServiceId]     = useState<string>(vendor.services[0]?.id ?? '');
  const [packageIdx, setPackageIdx]   = useState<number>(packages.length > 0 ? 0 : -1);
  const [guestCount, setGuestCount]   = useState<string>('');
  const [eventLocation, setLocation]  = useState<string>('');
  const [notes, setNotes]             = useState<string>('');
  const [addons, setAddons]           = useState<AddonRow[]>([]);

  const selectedService = vendor.services.find((s) => s.id === serviceId) ?? null;
  const selectedPackage = packageIdx >= 0 ? packages[packageIdx] : null;

  const addonsTotal = useMemo(
    () => addons.reduce((sum, a) => sum + (a.quantity || 0) * (a.unitPrice || 0), 0),
    [addons],
  );

  const total = useMemo(() => {
    const base = selectedPackage?.price ?? selectedService?.priceFrom ?? 0;
    return base + addonsTotal;
  }, [selectedPackage, selectedService, addonsTotal]);

  function addAddon() {
    setAddons((prev) => [...prev, newAddon()]);
  }
  function updateAddon(id: string, patch: Partial<AddonRow>) {
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeAddon(id: string) {
    setAddons((prev) => prev.filter((a) => a.id !== id));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!eventDate) { setError('Pick an event date.'); return; }
    if (total <= 0) { setError('Choose a service or package with a price.'); return; }

    const payload: Record<string, unknown> = {
      vendorId:     vendor.id,
      eventDate,
      ceremonyType,
      totalAmount:  total,
    };
    if (serviceId)     payload['serviceId']     = serviceId;
    if (selectedPackage) {
      payload['packageName']  = selectedPackage.name;
      payload['packagePrice'] = selectedPackage.price;
    }
    if (guestCount)    payload['guestCount']    = parseInt(guestCount, 10);
    if (eventLocation) payload['eventLocation'] = eventLocation.trim();
    if (notes.trim())  payload['notes']         = notes.trim();
    const validAddons = addons.filter((a) => a.name.trim() && a.unitPrice > 0);
    if (validAddons.length > 0) {
      payload['addons'] = validAddons.map((a) => ({
        name:      a.name.trim(),
        quantity:  a.quantity,
        unitPrice: a.unitPrice,
      }));
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/bookings`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(payload),
        });
        const json = await res.json() as { success: boolean; data?: { booking: { id: string } }; error?: { message?: string } };
        if (!res.ok || !json.success || !json.data?.booking) {
          setError(json.error?.message ?? 'Failed to create booking');
          return;
        }
        router.push(`/bookings/${json.data.booking.id}`);
      } catch {
        setError('Network error');
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Date picker */}
      <section className="rounded-2xl border border-gold/30 bg-surface p-5">
        <h2 className="text-base font-semibold text-primary mb-3">1. Pick a date</h2>
        <AvailabilityCalendar
          vendorId={vendor.id}
          selectedDate={eventDate || null}
          onSelect={setEventDate}
        />
        {eventDate && (
          <p className="mt-2 text-sm text-success">
            Selected: {new Date(eventDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </section>

      {/* Ceremony + service */}
      <section className="rounded-2xl border border-gold/30 bg-surface p-5 space-y-3">
        <h2 className="text-base font-semibold text-primary">2. Ceremony & service</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bk-ceremony" className="block text-xs font-medium text-muted-foreground mb-1">Ceremony</label>
            <select
              id="bk-ceremony"
              value={ceremonyType}
              onChange={(e) => setCeremony(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              {CEREMONY_TYPES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bk-service" className="block text-xs font-medium text-muted-foreground mb-1">Service</label>
            <select
              id="bk-service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={vendor.services.length === 0}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {vendor.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.priceFrom > 0 ? ` (₹${s.priceFrom.toLocaleString('en-IN')}+)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Packages */}
      {packages.length > 0 && (
        <section className="rounded-2xl border border-gold/30 bg-surface p-5">
          <h2 className="text-base font-semibold text-primary mb-3">3. Choose a package</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {packages.map((p, idx) => {
              const selected = idx === packageIdx;
              return (
                <button
                  key={`${p.name}-${idx}`}
                  type="button"
                  onClick={() => setPackageIdx(idx === packageIdx ? -1 : idx)}
                  className={`text-left rounded-xl border p-4 transition-colors ${selected ? 'border-teal bg-teal/5 ring-2 ring-teal' : 'border-gold/30 bg-surface hover:bg-gold/5'}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-primary">{p.name}</p>
                    <span className="text-teal font-bold text-sm">₹{p.price.toLocaleString('en-IN')}</span>
                  </div>
                  {p.inclusions && p.inclusions.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {p.inclusions.slice(0, 4).map((inc, i) => (
                        <li key={i}>• {inc}</li>
                      ))}
                      {p.inclusions.length > 4 && <li>+ {p.inclusions.length - 4} more</li>}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Event details */}
      <section className="rounded-2xl border border-gold/30 bg-surface p-5 space-y-3">
        <h2 className="text-base font-semibold text-primary">{packages.length > 0 ? '4.' : '3.'} Event details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="bk-guests" className="block text-xs font-medium text-muted-foreground mb-1">Guest count</label>
            <input
              id="bk-guests"
              type="number"
              min={1}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="bk-loc" className="block text-xs font-medium text-muted-foreground mb-1">Event venue / location</label>
            <input
              id="bk-loc"
              type="text"
              value={eventLocation}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={500}
              placeholder="Venue address or city"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="bk-notes" className="block text-xs font-medium text-muted-foreground mb-1">Special requests</label>
          <textarea
            id="bk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Anything specific the vendor should know"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* Add-ons */}
      <section className="rounded-2xl border border-gold/30 bg-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-primary">{packages.length > 0 ? '5.' : '4.'} Add-ons</h2>
          <button
            type="button"
            onClick={addAddon}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/40 bg-surface text-primary text-sm font-medium px-3 py-1.5 hover:bg-gold/10"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>
        {addons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add custom items like extra hours, equipment, decor upgrades, etc.</p>
        ) : (
          <ul className="space-y-2">
            {addons.map((a) => (
              <li key={a.id} className="grid grid-cols-12 items-center gap-2">
                <input
                  type="text"
                  placeholder="Item name"
                  value={a.name}
                  onChange={(e) => updateAddon(a.id, { name: e.target.value })}
                  className="col-span-6 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={a.quantity}
                  onChange={(e) => updateAddon(a.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                  className="col-span-2 rounded-lg border border-border bg-surface px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="₹"
                  value={a.unitPrice}
                  onChange={(e) => updateAddon(a.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="col-span-3 rounded-lg border border-border bg-surface px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeAddon(a.id)}
                  aria-label="Remove add-on"
                  className="col-span-1 inline-flex items-center justify-center text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Total + submit */}
      <section className="sticky bottom-2 rounded-2xl border border-gold/40 bg-surface/95 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Base</span>
          <span className="text-foreground">
            ₹{(selectedPackage?.price ?? selectedService?.priceFrom ?? 0).toLocaleString('en-IN')}
          </span>
        </div>
        {addonsTotal > 0 && (
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Add-ons</span>
            <span className="text-foreground">₹{addonsTotal.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gold/30 pt-2 mt-2">
          <span className="text-base font-semibold text-primary">Total</span>
          <span className="text-xl font-bold text-teal">₹{total.toLocaleString('en-IN')}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          50% will be held in escrow and released 48 hours after the event.
        </p>
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        <button
          type="submit"
          disabled={pending || total <= 0 || !eventDate}
          className="mt-3 w-full rounded-lg bg-teal hover:bg-teal-hover text-white font-semibold py-3 disabled:opacity-50"
        >
          {pending ? 'Creating booking…' : 'Request booking'}
        </button>
      </section>
    </form>
  );
}
