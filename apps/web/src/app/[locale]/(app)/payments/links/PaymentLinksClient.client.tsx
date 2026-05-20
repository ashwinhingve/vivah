'use client';

import { useState } from 'react';
import type { PaymentLinkRecord, PaymentLinkStatus } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { Container, EmptyState, PageHeader, Section } from '@/components/shared';
import { extractErrorMessage } from '@/lib/api-envelope';

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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_MAP: Record<PaymentLinkStatus, { className: string; label: string }> = {
  ACTIVE: { className: 'bg-success/15 text-success', label: 'Active' },
  PAID: { className: 'bg-teal/10 text-teal', label: 'Paid' },
  EXPIRED: { className: 'bg-secondary text-muted-foreground', label: 'Expired' },
  CANCELLED: { className: 'bg-destructive/15 text-destructive', label: 'Cancelled' },
};

interface Props {
  initialLinks: PaymentLinkRecord[];
}

interface CreateForm {
  amount: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  expiryHours: string;
  bookingId: string;
}

const EMPTY_FORM: CreateForm = {
  amount: '',
  description: '',
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  expiryHours: '48',
  bookingId: '',
};

export function PaymentLinksClient({ initialLinks }: Props) {
  const [links, setLinks] = useState<PaymentLinkRecord[]>(initialLinks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<PaymentLinkRecord | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: form.description.trim(),
          customerName: form.customerName.trim() || undefined,
          customerEmail: form.customerEmail.trim() || undefined,
          customerPhone: form.customerPhone.trim() || undefined,
          expiryHours: parseInt(form.expiryHours, 10) || 48,
          bookingId: form.bookingId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: PaymentLinkRecord };
      if (!res.ok || !json.success || !json.data) {
        setError(extractErrorMessage(json, 'Failed to create payment link.'));
        return;
      }
      setLinks((prev) => [json.data!, ...prev]);
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
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader
          title="Payment Links"
          subtitle="Create and share payment links with your customers"
          action={
            <Button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setError(null);
              }}
            >
              {showForm ? 'Cancel' : 'Create New Link'}
            </Button>
          }
        />

        {newLink ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-teal bg-teal/5 px-5 py-4"
          >
            <p className="mb-1 text-sm font-semibold text-teal">Payment link created</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate font-mono text-xs text-foreground">
                {newLink.razorpayShortUrl ?? `https://pay.smartshaadi.in/l/${newLink.shortId}`}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyUrl(newLink)}
                className="border-teal text-teal hover:bg-teal/10"
              >
                {copiedId === newLink.id ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : null}

        {showForm ? (
          <Section title="New Payment Link" className="mb-6">
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
                <Field label="Amount (₹)" name="amount" type="number" placeholder="5000" value={form.amount} onChange={handleChange} required />
                <Field label="Expiry (hours)" name="expiryHours" type="number" placeholder="48" value={form.expiryHours} onChange={handleChange} />
              </div>

              <Field label="Description" name="description" type="text" placeholder="Photography package — 4 hours" value={form.description} onChange={handleChange} required />

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Customer name" name="customerName" type="text" placeholder="Priya Sharma" value={form.customerName} onChange={handleChange} />
                <Field label="Customer email" name="customerEmail" type="email" placeholder="priya@example.com" value={form.customerEmail} onChange={handleChange} />
                <Field label="Customer phone" name="customerPhone" type="tel" placeholder="9876543210" value={form.customerPhone} onChange={handleChange} />
              </div>

              <Field
                label="Booking ID (optional)"
                name="bookingId"
                type="text"
                placeholder="Link to an existing booking"
                value={form.bookingId}
                onChange={handleChange}
              />

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Creating…' : 'Create Payment Link'}
              </Button>
            </form>
          </Section>
        ) : null}

        {links.length === 0 ? (
          <EmptyState
            title="No payment links yet"
            description="Create a link to request payment from a customer directly."
          />
        ) : (
          <ul className="space-y-4">
            {links.map((link) => {
              const badge =
                STATUS_MAP[link.status] ?? {
                  className: 'bg-secondary text-muted-foreground',
                  label: link.status,
                };
              const url = link.razorpayShortUrl ?? `https://pay.smartshaadi.in/l/${link.shortId}`;
              return (
                <li
                  key={link.id}
                  className="rounded-xl border border-gold bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{link.description}</p>
                      {link.customerName ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          For: {link.customerName}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Created {formatDate(link.createdAt)}
                        {link.expiresAt ? ` · Expires ${formatDate(link.expiresAt)}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-primary">
                      {formatINR(link.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {link.paidAt ? (
                      <span className="text-xs text-muted-foreground">
                        Paid {formatDate(link.paidAt)}
                      </span>
                    ) : null}
                  </div>

                  {link.status === 'ACTIVE' ? (
                    <div className="mt-3 flex items-center gap-2">
                      <p className="flex-1 truncate font-mono text-xs text-muted-foreground">
                        {url}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyUrl(link)}
                        className="border-teal text-teal hover:bg-teal/10"
                      >
                        {copiedId === link.id ? 'Copied!' : 'Copy link'}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </main>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

function Field({ label, name, type, placeholder, value, onChange, required }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground" htmlFor={name}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}
