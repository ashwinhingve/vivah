'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RazorpayCheckout } from './RazorpayCheckout.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props { isOpen: boolean; onClose: () => void }

export function WalletTopupModal({ isOpen, onClose }: Props) {
  const [amount, setAmount] = useState(500);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!isOpen) return null;

  async function createOrder(): Promise<void> {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/wallet/topup`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: { orderId: string } };
      setOrderId(json.data.orderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-xl bg-white p-6 shadow-lg max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-semibold text-[#0A1F4D]">Top up wallet</h2>
        <label className="block mb-3">
          <span className="text-sm font-medium text-slate-700">Amount (₹)</span>
          <input
            type="number" min={1} max={100000}
            value={amount}
            onChange={e => setAmount(Math.max(1, Math.min(100000, Number(e.target.value))))}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <div className="mb-4 flex gap-2">
          {[500, 1000, 2000, 5000].map(v => (
            <button key={v} type="button" onClick={() => setAmount(v)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">₹{v}</button>
          ))}
        </div>
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
          {orderId ? (
            <RazorpayCheckout
              orderId={orderId}
              amount={amount}
              bookingId="wallet-topup"
              onSuccess={() => { onClose(); router.refresh(); }}
              onFailure={(e) => setError(e.description)}
              buttonLabel={`Pay ₹${amount}`}
            />
          ) : (
            <button
              onClick={createOrder}
              disabled={loading || amount <= 0}
              className="min-h-[44px] px-5 rounded-lg bg-[#0A1F4D] text-white font-medium hover:bg-[#1848C8] disabled:opacity-50"
            >{loading ? 'Creating…' : 'Continue'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
