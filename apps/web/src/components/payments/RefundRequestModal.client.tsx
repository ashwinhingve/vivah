'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST:  'I no longer need this service',
  SERVICE_CANCELLED: 'Service was cancelled by vendor',
  VENDOR_NO_SHOW:    'Vendor did not show up',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  DISPUTE_RESOLVED:  'Dispute resolved in my favour',
  OTHER:             'Other reason',
};

interface Props {
  paymentId:  string;
  maxAmount:  number;
  onClose:    () => void;
  onSuccess:  () => void;
}

export function RefundRequestModal({ paymentId, maxAmount, onClose, onSuccess }: Props) {
  const [reason,          setReason]          = useState('CUSTOMER_REQUEST');
  const [reasonDetails,   setReasonDetails]   = useState('');
  const [amount,          setAmount]          = useState('');
  const [refundToWallet,  setRefundToWallet]  = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = amount ? parseFloat(amount) : undefined;
    if (parsedAmount !== undefined && (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > maxAmount)) {
      setError(`Amount must be between ₹1 and ₹${maxAmount.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/refunds/request`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          reason,
          reasonDetails: reasonDetails.trim() || undefined,
          amount:        parsedAmount,
          refundToWallet,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Failed to submit refund request. Please try again.');
        return;
      }
      onSuccess();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface border shadow-xl"
        style={{ borderColor: '#C5A47E' }}
      >
        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#C5A47E' }}>
          <h2 id="refund-modal-title" className="font-heading text-lg font-semibold" style={{ color: '#7B2D42' }}>
            Request a Refund
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your request will be reviewed within 2 business days.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1" htmlFor="refund-reason">
              Reason
            </label>
            <select
              id="refund-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            >
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Additional details */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1" htmlFor="refund-details">
              Additional details <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="refund-details"
              value={reasonDetails}
              onChange={e => setReasonDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Please describe your issue in detail…"
              className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 resize-none"
            />
          </div>

          {/* Partial amount */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1" htmlFor="refund-amount">
              Amount (₹) <span className="text-muted-foreground font-normal">— leave blank for full refund of ₹{maxAmount.toLocaleString('en-IN')}</span>
            </label>
            <input
              id="refund-amount"
              type="number"
              min="1"
              max={maxAmount}
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Up to ₹${maxAmount.toLocaleString('en-IN')}`}
              className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </div>

          {/* Refund to wallet */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={refundToWallet}
              onChange={e => setRefundToWallet(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-teal"
            />
            <span className="text-sm text-foreground">
              Credit refund to my Smart Shaadi wallet <span className="text-muted-foreground">(instant; can be used for future bookings)</span>
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
