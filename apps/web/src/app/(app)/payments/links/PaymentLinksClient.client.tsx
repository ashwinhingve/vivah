'use client';

import { useState } from 'react';
import type { PaymentLinkRecord, PaymentLinkStatus } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_MAP: Record<PaymentLinkStatus, { bg: string; text: string; label: string }> = {
  ACTIVE:    { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Active' },
  PAID:      { bg: 'bg-teal/10',    text: 'text-teal',       label: 'Paid' },
  EXPIRED:   { bg: 'bg-secondary',  text: 'text-muted-foreground',  label: 'Expired' },
  CANCELLED: { bg: 'bg-destructive/15',    text: 'text-destructive',    label: 'Cancelled' },
};

interface Props {
  initialLinks: PaymentLinkRecord[];
}

interface CreateForm {
  amount:       string;
  description:  string;
  customerName: string;
  customerEmail:string;
  customerPhone:string;
  expiryHours:  string;
  bookingId:    string;
}

const EMPTY_FORM: CreateForm = {
  amount:       '',
  description:  '',
  customerName: '',
  customerEmail:'',
  customerPhone:'',
  expiryHours:  '48',
  bookingId:    '',
};

export function PaymentLinksClient({ initialLinks }: Props) {
  const [links,        setLinks]        = useState<PaymentLinkRecord[]>(initialLinks);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState<CreateForm>(EMPTY_FORM);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [newLink,      setNewLink]      = useState<PaymentLinkRecord | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/links`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:        amount,
          description:   form.description.trim(),
          customerName:  form.customerName.trim() || undefined,
          customerEmail: form.customerEmail.trim() || undefined,
          customerPhone: form.customerPhone.trim() || undefined,
          expiryHours:   parseInt(form.expiryHours, 10) || 48,
          bookingId:     form.bookingId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: PaymentLinkRecord; error?: string };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'Failed to create payment link.');
        return;
      }
      setLinks(prev => [json.data!, ...prev]);
      setNewLink(json.data!);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyUrl(link: PaymentLinkRecord) {
    const url = link.razorpayShortUrl ?? `https://pay.smartshaadi.in/l/${link.shortId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Payment Links</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and share payment links with your customers
            </p>
          </div>
          <Button
            type="button"
            onClick={() => { setShowForm(v => !v); setError(null); }}
          >
            {showForm ? 'Cancel' : 'Create New Link'}
          </Button>
        </div>

        {/* New link success banner */}
        {newLink && (
          <div
            className="mb-4 rounded-xl border px-5 py-4 border-teal bg-teal/5"
          >
            <p className="text-sm font-semibold text-teal mb-1">Payment link created</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono text-foreground flex-1 truncate">
                {newLink.razorpayShortUrl ?? `https://pay.smartshaadi.in/l/${newLink.shortId}`}
              </p>
              <button
                type="button"
                onClick={() => copyUrl(newLink)}
                className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-teal/10 border-teal text-teal"
              >
                {copiedId === newLink.id ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border shadow-sm p-5 space-y-4 bg-surface border-gold"
          >
            <h2 className="font-heading text-base font-semibold text-primary">
              New Payment Link
            </h2>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="Amount (₹)" name="amount" type="number" placeholder="5000" value={form.amount} onChange={handleChange} required />
              <FormField label="Expiry (hours)" name="expiryHours" type="number" placeholder="48" value={form.expiryHours} onChange={handleChange} />
            </div>

            <FormField label="Description" name="description" type="text" placeholder="Photography package — 4 hours" value={form.description} onChange={handleChange} required />

            <div className="grid sm:grid-cols-3 gap-4">
              <FormField label="Customer name" name="customerName" type="text" placeholder="Priya Sharma" value={form.customerName} onChange={handleChange} />
              <FormField label="Customer email" name="customerEmail" type="email" placeholder="priya@example.com" value={form.customerEmail} onChange={handleChange} />
              <FormField label="Customer phone" name="customerPhone" type="tel" placeholder="9876543210" value={form.customerPhone} onChange={handleChange} />
            </div>

            <FormField label="Booking ID (optional)" name="bookingId" type="text" placeholder="Link to an existing booking" value={form.bookingId} onChange={handleChange} />

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Creating…' : 'Create Payment Link'}
            </Button>
          </form>
        )}

        {/* Links list */}
        {links.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center border-gold">
            <p className="font-medium text-primary">No payment links yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a link to request payment from a customer directly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map(link => {
              const badge = STATUS_MAP[link.status] ?? { bg: 'bg-secondary', text: 'text-muted-foreground', label: link.status };
              const url   = link.razorpayShortUrl ?? `https://pay.smartshaadi.in/l/${link.shortId}`;
              return (
                <div
                  key={link.id}
                  className="rounded-xl bg-surface border shadow-sm p-5 border-gold"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{link.description}</p>
                      {link.customerName && (
                        <p className="text-xs text-muted-foreground mt-0.5">For: {link.customerName}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {formatDate(link.createdAt)}
                        {link.expiresAt && ` · Expires ${formatDate(link.expiresAt)}`}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-primary">
                      {formatINR(link.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {link.paidAt && (
                      <span className="text-xs text-muted-foreground">Paid {formatDate(link.paidAt)}</span>
                    )}
                  </div>

                  {link.status === 'ACTIVE' && (
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{url}</p>
                      <button
                        type="button"
                        onClick={() => copyUrl(link)}
                        className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-teal/10 border-teal text-teal"
                      >
                        {copiedId === link.id ? 'Copied!' : 'Copy link'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal field component ──────────────────────────────────────────────────

interface FieldProps {
  label:       string;
  name:        string;
  type:        string;
  placeholder: string;
  value:       string;
  onChange:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?:   boolean;
}

function FormField({ label, name, type, placeholder, value, onChange, required }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1" htmlFor={name}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />
    </div>
  );
}
