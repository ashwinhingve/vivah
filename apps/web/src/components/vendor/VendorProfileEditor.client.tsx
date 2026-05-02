'use client';

import { useState, useTransition } from 'react';
import type { VendorProfile } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface VendorProfileEditorProps {
  vendor: VendorProfile;
}

export function VendorProfileEditor({ vendor }: VendorProfileEditorProps) {
  const [businessName, setName]   = useState(vendor.businessName);
  const [tagline, setTagline]     = useState(vendor.tagline ?? '');
  const [description, setDesc]    = useState(vendor.description ?? '');
  const [phone, setPhone]         = useState(vendor.phone ?? '');
  const [email, setEmail]         = useState(vendor.email ?? '');
  const [website, setWebsite]     = useState(vendor.website ?? '');
  const [instagram, setInsta]     = useState(vendor.instagram ?? '');
  const [yearsActive, setYears]   = useState(vendor.yearsActive ?? '');
  const [responseHours, setResp]  = useState(vendor.responseTimeHours ?? '');
  const [priceMin, setPmin]       = useState(vendor.priceMin ?? '');
  const [priceMax, setPmax]       = useState(vendor.priceMax ?? '');

  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const patch: Record<string, unknown> = {
      businessName: businessName.trim(),
      tagline:      tagline.trim() || null,
      description:  description.trim() || null,
      phone:        phone.trim() || null,
      email:        email.trim() || null,
      website:      website.trim() || null,
      instagram:    instagram.trim() || null,
      yearsActive:  yearsActive === '' ? null : Number(yearsActive),
      responseTimeHours: responseHours === '' ? null : Number(responseHours),
      priceMin:     priceMin === '' ? null : Number(priceMin),
      priceMax:     priceMax === '' ? null : Number(priceMax),
    };

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/${vendor.id}`, {
          method:      'PATCH',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(patch),
        });
        const json = await res.json() as { success: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? 'Failed to save');
          return;
        }
        setSuccess(true);
      } catch {
        setError('Network error');
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-gold/30 bg-surface p-5">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Business name</label>
        <input
          type="text"
          required
          value={businessName}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Tagline</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={255}
          placeholder="Your one-line pitch"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">About / description</label>
        <textarea
          rows={4}
          maxLength={5000}
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Tell couples what makes you stand out…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Website</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={500} placeholder="https://" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Instagram</label>
          <input type="text" value={instagram} onChange={(e) => setInsta(e.target.value)} maxLength={255} placeholder="@username" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Years active</label>
          <input type="number" min={0} max={100} value={yearsActive} onChange={(e) => setYears(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Avg response time (hours)</label>
          <input type="number" min={0} max={168} value={responseHours} onChange={(e) => setResp(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Min price (₹)</label>
          <input type="number" min={0} value={priceMin} onChange={(e) => setPmin(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Max price (₹)</label>
          <input type="number" min={0} value={priceMax} onChange={(e) => setPmax(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {success && <p className="text-sm text-success">Saved!</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
