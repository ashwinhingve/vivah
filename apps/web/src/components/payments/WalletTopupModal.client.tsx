'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RazorpayCheckout } from './RazorpayCheckout.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [500, 1000, 2000, 5000];

export function WalletTopupModal({ isOpen, onClose }: Props) {
  const [amount, setAmount] = useState(500);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function createOrder(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/wallet/topup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: { orderId: string } };
      setOrderId(json.data.orderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Top up wallet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount">Amount (₹)</Label>
            <Input
              id="topup-amount"
              type="number"
              min={1}
              max={100000}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(1, Math.min(100000, Number(e.target.value))))
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={amount === v ? 'default' : 'outline'}
                onClick={() => setAmount(v)}
              >
                ₹{v.toLocaleString('en-IN')}
              </Button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {orderId ? (
            <RazorpayCheckout
              orderId={orderId}
              amount={amount}
              bookingId="wallet-topup"
              onSuccess={() => {
                onClose();
                router.refresh();
              }}
              onFailure={(e) => setError(e.description)}
              buttonLabel={`Pay ₹${amount.toLocaleString('en-IN')}`}
            />
          ) : (
            <Button
              type="button"
              variant="default"
              onClick={createOrder}
              disabled={loading || amount <= 0}
            >
              {loading ? 'Creating…' : 'Continue'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
