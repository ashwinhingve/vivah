'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuickStockFormProps {
  productId: string;
  currentStock: number;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function QuickStockForm({ productId, currentStock }: QuickStockFormProps) {
  const router = useRouter();
  const [stockQty, setStockQty] = useState(currentStock.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInt(stockQty, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError('Enter a valid stock quantity (0 or more).');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/products/${productId}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stockQty: parsed }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? 'Failed to update stock.');
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <div className="flex-1">
        <label htmlFor="qs-stock" className="sr-only">
          Stock quantity
        </label>
        <input
          id="qs-stock"
          type="number"
          min="0"
          step="1"
          value={stockQty}
          onChange={(e) => {
            setStockQty(e.target.value);
            setSuccess(false);
          }}
          className="w-full rounded-lg border border-[#C5A47E]/30 bg-[#FEFAF6] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#0E7C7B] focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]/40 transition-colors"
          placeholder="New stock qty"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 min-h-[44px] px-4 py-2 rounded-lg bg-[#0E7C7B] text-white text-sm font-semibold hover:bg-[#0E7C7B]/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Update'}
      </button>
      {success && (
        <span className="text-xs text-emerald-600 font-medium">Updated!</span>
      )}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </form>
  );
}
