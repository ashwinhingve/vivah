'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const MIN_REASON = 10;
const MAX_REASON = 1000;

interface DisputeFormProps {
  bookingId: string;
}

export function DisputeForm({ bookingId }: DisputeFormProps) {
  const router = useRouter();
  const [reason, setReason]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const charCount = reason.length;
  const isValid   = charCount >= MIN_REASON && charCount <= MAX_REASON;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/${bookingId}/dispute`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ reason }),
      });

      const json = (await res.json()) as { success: boolean; error?: { message?: string } };

      if (!json.success) {
        setError(json.error?.message ?? 'Failed to raise dispute. Please try again.');
        return;
      }

      router.push(`/bookings/${bookingId}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Warning banner */}
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-warning" aria-hidden="true">⚠</span>
          <p className="text-sm text-warning">
            <strong>Important:</strong> Disputes freeze your escrow payment until admin resolution.
            This process may take 1–3 business days. Only raise a dispute if you have a genuine
            concern that cannot be resolved directly with the vendor.
          </p>
        </div>
      </div>

      {/* Reason textarea */}
      <div className="space-y-1.5">
        <label
          htmlFor="dispute-reason"
          className="block text-sm font-medium text-[#0F172A]"
        >
          Reason for dispute
          <span className="ml-1 text-destructive" aria-hidden="true">*</span>
        </label>
        <textarea
          id="dispute-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          maxLength={MAX_REASON}
          placeholder="Describe your issue clearly (minimum 10 characters)…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-[#0F172A] placeholder-[#64748B] shadow-sm outline-none ring-0 transition focus:border-[#1848C8] focus:ring-2 focus:ring-[#1848C8]/20 resize-none"
          disabled={loading}
          required
        />
        <div className="flex items-center justify-between">
          <p
            className={`text-xs ${charCount < MIN_REASON ? 'text-warning' : 'text-[#64748B]'}`}
          >
            {charCount < MIN_REASON
              ? `${MIN_REASON - charCount} more characters required`
              : 'Looks good'}
          </p>
          <p className={`text-xs ${charCount > MAX_REASON * 0.9 ? 'text-warning' : 'text-[#64748B]'}`}>
            {charCount} / {MAX_REASON}
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="min-h-[44px] w-full rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-[#0F172A] transition hover:bg-secondary disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid || loading}
          className="min-h-[44px] w-full rounded-lg bg-destructive px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-destructive disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? 'Raising dispute…' : 'Raise Dispute'}
        </button>
      </div>
    </form>
  );
}
