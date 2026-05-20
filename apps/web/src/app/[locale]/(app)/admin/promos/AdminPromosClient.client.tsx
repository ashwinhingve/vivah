'use client';

import { useState } from 'react';
import type { PromoCodeRecord, PromoType, PromoScope } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Container,
  DataTable,
  type DataTableColumn,
  PageHeader,
  Section,
} from '@/components/shared';
import { extractErrorMessage } from '@/lib/api-envelope';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function formatDate(iso: string | null): string {
  if (!iso) return 'No expiry';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

interface CreateForm {
  code: string;
  description: string;
  type: PromoType;
  value: string;
  scope: PromoScope;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  validFrom: string;
  validUntil: string;
  firstTimeOnly: boolean;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: CreateForm = {
  code: '',
  description: '',
  type: 'PERCENT',
  value: '',
  scope: 'ALL',
  minOrderAmount: '0',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '1',
  validFrom: todayISO(),
  validUntil: '',
  firstTimeOnly: false,
};

interface Props {
  initialPromos: PromoCodeRecord[];
}

export function AdminPromosClient({ initialPromos }: Props) {
  const [promos, setPromos] = useState<PromoCodeRecord[]>(initialPromos);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
      const res = await fetch(`${API_URL}/api/v1/payments/promos/admin/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          value: parseFloat(form.value),
          scope: form.scope,
          minOrderAmount: parseFloat(form.minOrderAmount) || 0,
          maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
          usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : undefined,
          perUserLimit: parseInt(form.perUserLimit, 10) || 1,
          validFrom: form.validFrom,
          validUntil: form.validUntil || undefined,
          firstTimeUserOnly: form.firstTimeOnly,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: PromoCodeRecord };
      if (!res.ok || !json.success || !json.data) {
        setError(extractErrorMessage(json, 'Failed to create promo code.'));
        return;
      }
      setPromos((prev) => [json.data!, ...prev]);
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
        setPromos((prev) =>
          prev.map((p) => (p.code === code ? { ...p, isActive: !currentlyActive } : p))
        );
      }
    } finally {
      setToggling(null);
    }
  }

  const columns: DataTableColumn<PromoCodeRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (p) => <span className="font-mono text-xs font-bold text-foreground">{p.code}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      render: (p) => (
        <span className="text-xs text-foreground">
          {p.type === 'PERCENT' ? `${p.value}%` : formatINR(p.value)}
          {p.maxDiscount ? (
            <span className="ml-1 text-muted-foreground">max {formatINR(p.maxDiscount)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (p) => <span className="text-xs capitalize text-muted-foreground">{p.scope.toLowerCase()}</span>,
    },
    {
      key: 'used',
      header: 'Used',
      render: (p) => (
        <span className="text-xs text-foreground">
          {p.usedCount}
          {p.usageLimit ? ` / ${p.usageLimit}` : ''}
        </span>
      ),
    },
    {
      key: 'validUntil',
      header: 'Valid until',
      render: (p) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(p.validUntil)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (p) => (
        <Switch
          checked={p.isActive}
          disabled={toggling === p.code}
          onCheckedChange={() => toggleActive(p.code, p.isActive)}
          aria-label={p.isActive ? `Deactivate ${p.code}` : `Activate ${p.code}`}
        />
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="default">
        <PageHeader
          title="Promo Codes"
          subtitle="Create and manage discount codes for customers"
          action={
            <Button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setError(null);
              }}
            >
              {showForm ? 'Cancel' : 'Create Code'}
            </Button>
          }
        />

        {showForm ? (
          <Section title="New Promo Code" className="mb-6">
            <form onSubmit={handleCreate} className="space-y-4">
              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <F label="Code" name="code" type="text" placeholder="SHAADI20" value={form.code} onChange={handleChange} required />
                <F label="Description" name="description" type="text" placeholder="20% off on bookings" value={form.description} onChange={handleChange} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="promo-type">
                    Type
                  </label>
                  <select
                    id="promo-type"
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="PERCENT">Percentage</option>
                    <option value="FLAT">Flat amount</option>
                  </select>
                </div>
                <F
                  label={form.type === 'PERCENT' ? 'Discount %' : 'Discount (₹)'}
                  name="value"
                  type="number"
                  placeholder={form.type === 'PERCENT' ? '20' : '500'}
                  value={form.value}
                  onChange={handleChange}
                  required
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="promo-scope">
                    Scope
                  </label>
                  <select
                    id="promo-scope"
                    name="scope"
                    value={form.scope}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="ALL">All</option>
                    <option value="BOOKING">Bookings</option>
                    <option value="STORE">Store</option>
                    <option value="WEDDING">Wedding</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <F label="Min order (₹)" name="minOrderAmount" type="number" placeholder="0" value={form.minOrderAmount} onChange={handleChange} />
                <F label="Max discount (₹)" name="maxDiscount" type="number" placeholder="No cap" value={form.maxDiscount} onChange={handleChange} />
                <F label="Total usage limit" name="usageLimit" type="number" placeholder="Unlimited" value={form.usageLimit} onChange={handleChange} />
                <F label="Per user limit" name="perUserLimit" type="number" placeholder="1" value={form.perUserLimit} onChange={handleChange} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <F label="Valid from" name="validFrom" type="date" placeholder="" value={form.validFrom} onChange={handleChange} required />
                <F label="Valid until (optional)" name="validUntil" type="date" placeholder="" value={form.validUntil} onChange={handleChange} />
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="firstTimeOnly"
                  checked={form.firstTimeOnly}
                  onChange={handleChange}
                  className="h-4 w-4 rounded accent-teal"
                />
                <span className="text-sm text-foreground">First-time users only</span>
              </label>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Creating…' : 'Create Promo Code'}
              </Button>
            </form>
          </Section>
        ) : null}

        <DataTable
          columns={columns}
          data={promos}
          rowKey={(p) => p.id}
          empty={{
            title: 'No promo codes yet',
            description: 'Create a discount code to attract more customers.',
          }}
        />
      </Container>
    </main>
  );
}

interface FProps {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}
function F({ label, name, type, placeholder, value, onChange, required }: FProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground" htmlFor={`pf-${name}`}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <input
        id={`pf-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}
