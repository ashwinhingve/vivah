'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: 'I no longer need this service',
  SERVICE_CANCELLED: 'Service was cancelled by vendor',
  VENDOR_NO_SHOW: 'Vendor did not show up',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  DISPUTE_RESOLVED: 'Dispute resolved in my favour',
  OTHER: 'Other reason',
};

interface Props {
  paymentId: string;
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundRequestModal({ paymentId, maxAmount, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('CUSTOMER_REQUEST');
  const [reasonDetails, setReasonDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [refundToWallet, setRefundToWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = amount ? parseFloat(amount) : undefined;
    if (
      parsedAmount !== undefined &&
      (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > maxAmount)
    ) {
      setError(`Amount must be between ₹1 and ₹${maxAmount.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/refunds/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          reason,
          reasonDetails: reasonDetails.trim() || undefined,
          amount: parsedAmount,
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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Refund</DialogTitle>
          <DialogDescription>
            Your request will be reviewed within 2 business days.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="refund-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-details">
              Additional details{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="refund-details"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Please describe your issue in detail…"
              className="w-full resize-none rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">
              Amount (₹){' '}
              <span className="font-normal text-muted-foreground">
                — leave blank for full refund of ₹{maxAmount.toLocaleString('en-IN')}
              </span>
            </Label>
            <Input
              id="refund-amount"
              type="number"
              min={1}
              max={maxAmount}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ₹${maxAmount.toLocaleString('en-IN')}`}
            />
          </div>

          <Label htmlFor="refund-wallet" className="flex cursor-pointer items-start gap-3 font-normal">
            <Checkbox
              id="refund-wallet"
              checked={refundToWallet}
              onCheckedChange={(c) => setRefundToWallet(c === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground">
              Credit refund to my Smart Shaadi wallet{' '}
              <span className="text-muted-foreground">
                (instant; can be used for future bookings)
              </span>
            </span>
          </Label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
