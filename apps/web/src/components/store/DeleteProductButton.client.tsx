'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteProductButtonProps {
  productId: string;
  productName: string;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function DeleteProductButton({ productId, productName }: DeleteProductButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? 'Failed to delete product.');
        setConfirming(false);
        return;
      }
      router.push('/vendor-dashboard/store');
    } catch {
      setError('Network error. Please try again.');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-xs text-[#64748B] max-w-[180px] text-right">
          Delete &ldquo;{productName}&rdquo;? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-[#64748B] border border-[#C5A47E]/30 rounded-lg hover:border-[#64748B] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-white bg-destructive rounded-lg hover:bg-destructive transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors"
    >
      Delete
    </button>
  );
}
