'use client';

import { useState } from 'react';
import type { PromoCodeRecord, PromoType, PromoScope } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function formatDate(iso: string | null): string {
  if (!iso) return 'No expiry';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(num);
}

interface CreateForm {
  code:           string;
  description:    string;
  type:           PromoType;
  value:          string;
  scope:          PromoScope;
  minOrderAmount: string;
  maxDiscount:    string;
  usageLimit:     string;
  perUserLimit:   string;
  validFrom:      string;
  validUntil:     string;
  firstTimeOnly:  boolean;
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

const EMPTY_FORM: CreateForm = {
  code:           '',
  description:    '',
  type:           'PERCENT',
  value:          '',
  scope:          'ALL',
  minOrderAmount: '0',
  maxDiscount:    '',
  usageLimit:     '',
  perUserLimit:   '1',
  validFrom:      todayISO(),
  validUntil:     '',
  firstTimeOnly:  false,
};

interface Props {
  initialPromos: PromoCodeRecord[];
}

export function AdminPromosClient({ initialPromos }: Props) {
  const [promos,    setPromos]    = useState<PromoCodeRecord[]>(initialPromos);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<CreateForm>(EMPTY_FORM);
  const [submitting,setSubmitting]= useState(false);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.code.trim() || !form.value) {
      setError('Code and value are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/promos`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code:           form.code.toUpperCase().trim(),
          description:    form.description.trim() || undefined,
          type:           form.type,
          value:          parseFloat(form.value),
          scope:          form.scope,
          minOrderAmount: parseFloat(form.minOrderAmount) || 0,
          maxDiscount:    form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
          usageLimit:     form.usageLimit ? parseInt(form.usageLimit, 10) : undefined,
          perUserLimit:   parseInt(form.perUserLimit, 10) || 1,
          validFrom:      form.validFrom,
          validUntil:     form.validUntil || undefined,
          firstTimeUserOnly: form.firstTimeOnly,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: PromoCodeRecord; error?: string };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'Failed to create promo code.');
        return;
      }
      setPromos(prev => [json.data!, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(code: string, currentlyActive: boolean) {
    setToggling(code);
    try {
      const endpoint = currentlyActive
        ? `${API_URL}/api/v1/payments/promos/admin/deactivate/${code}`
        : `${API_URL}/api/v1/payments/promos/admin/activate/${code}`;
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        setPromos(prev => prev.map(p => p.code === code ? { ...p, isActive: !currentlyActive } : p));
      }
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Promo Codes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create and manage discount codes for customers</p>
          </div>
          <Button type="button" onClick={() => { setShowForm(v => !v); setError(null); }}>
            {showForm ? 'Cancel' : 'Create Code'}
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border shadow-sm p-5 space-y-4 bg-surface border-gold"
          >
            <h2 className="font-heading text-base font-semibold text-primary">New Promo Code</h2>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <F label="Code" name="code" type="text" placeholder="SHAADI20" value={form.code} onChange={handleChange} required />
              <F label="Description" name="description" type="text" placeholder="20% off on bookings" value={form.description} onChange={handleChange} />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="promo-type">Type</label>
                <select id="promo-type" name="type" value={form.type} onChange={handleChange}
                  className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus:border-teal">
                  <option value="PERCENT">Percentage</option>
                  <option value="FLAT">Flat amount</option>
                </select>
              </div>
              <F label={form.type === 'PERCENT' ? 'Discount %' : 'Discount (₹)'} name="value" type="number" placeholder={form.type === 'PERCENT' ? '20' : '500'} value={form.value} onChange={handleChange} required />
              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="promo-scope">Scope</label>
                <select id="promo-scope" name="scope" value={form.scope} onChange={handleChange}
                  className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus:border-teal">
                  <option value="ALL">All</option>
                  <option value="BOOKING">Bookings</option>
                  <option value="STORE">Store</option>
                  <option value="WEDDING">Wedding</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              <F label="Min order (₹)" name="minOrderAmount" type="number" placeholder="0" value={form.minOrderAmount} onChange={handleChange} />
              <F label="Max discount (₹)" name="maxDiscount" type="number" placeholder="No cap" value={form.maxDiscount} onChange={handleChange} />
              <F label="Total usage limit" name="usageLimit" type="number" placeholder="Unlimited" value={form.usageLimit} onChange={handleChange} />
              <F label="Per user limit" name="perUserLimit" type="number" placeholder="1" value={form.perUserLimit} onChange={handleChange} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <F label="Valid from" name="validFrom" type="date" placeholder="" value={form.validFrom} onChange={handleChange} required />
              <F label="Valid until (optional)" name="validUntil" type="date" placeholder="" value={form.validUntil} onChange={handleChange} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="firstTimeOnly" checked={form.firstTimeOnly}
                onChange={handleChange} className="h-4 w-4 rounded accent-teal" />
              <span className="text-sm text-foreground">First-time users only</span>
            </label>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Creating…' : 'Create Promo Code'}
            </Button>
          </form>
        )}

        {/* Promos table */}
        {promos.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center border-gold">
            <p className="font-medium text-primary">No promo codes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a discount code to attract more customers.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden shadow-sm border-gold">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Scope</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Used</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Valid until</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-gold/15">
                  {promos.map(promo => (
                    <tr key={promo.id} className="bg-surface hover:bg-gold/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{promo.code}</td>
                      <td className="px-4 py-3 text-xs text-foreground">
                        {promo.type === 'PERCENT'
                          ? `${promo.value}%`
                          : formatINR(promo.value)
                        }
                        {promo.maxDiscount && (
                          <span className="text-muted-foreground ml-1">max {formatINR(promo.maxDiscount)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {promo.scope.toLowerCase()}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground">
                        {promo.usedCount}{promo.usageLimit ? ` / ${promo.usageLimit}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(promo.validUntil)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleActive(promo.code, promo.isActive)}
                          disabled={toggling === promo.code}
                          aria-label={promo.isActive ? 'Deactivate' : 'Activate'}
                          className={[
                            'relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none',
                            promo.isActive ? 'bg-teal' : 'bg-border',
                            toggling === promo.code ? 'opacity-50' : '',
                          ].join(' ')}
                        >
                          <span className={[
                            'absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-transform',
                            promo.isActive ? 'translate-x-4' : 'translate-x-0.5',
                          ].join(' ')} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal field component ──────────────────────────────────────────────────
interface FProps {
  label:     string;
  name:      string;
  type:      string;
  placeholder: string;
  value:     string;
  onChange:  (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}
function F({ label, name, type, placeholder, value, onChange, required }: FProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1" htmlFor={`pf-${name}`}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input id={`pf-${name}`} name={name} type={type} placeholder={placeholder} value={value}
        onChange={onChange} required={required}
        className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />
    </div>
  );
}
