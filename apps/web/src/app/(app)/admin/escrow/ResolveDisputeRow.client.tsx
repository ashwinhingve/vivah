'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type Resolution = 'RELEASE' | 'REFUND' | 'SPLIT';

interface ResolveOption {
  label:       string;
  resolution:  Resolution;
  splitRatio?: number;
}

const RESOLVE_OPTIONS: ResolveOption[] = [
  { label: 'Release to Vendor',         resolution: 'RELEASE' },
  { label: 'Refund to Customer',        resolution: 'REFUND'  },
  { label: 'Split 50/50',               resolution: 'SPLIT',  splitRatio: 0.5  },
  { label: 'Split 70/30 (vendor/cust)', resolution: 'SPLIT',  splitRatio: 0.7  },
  { label: 'Split 30/70 (vendor/cust)', resolution: 'SPLIT',  splitRatio: 0.3  },
  { label: 'Custom split %',            resolution: 'SPLIT'   },
];

interface DisputedBookingRow {
  bookingId:    string;
  customerName: string;
  vendorId:     string;
  totalAmount:  string;
  escrowHeld:   string;
  raisedAt:     string;
}

interface ResolveDisputeRowProps {
  booking:  DisputedBookingRow;
  onResolved: (bookingId: string) => void;
}

function formatInr(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function ResolveDisputeRow({ booking, onResolved }: ResolveDisputeRowProps) {
  const router                          = useRouter();
  const [selected, setSelected]         = useState<string>('');
  const [customRatio, setCustomRatio]   = useState<string>('');
  const [confirming, setConfirming]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [resolved, setResolved]         = useState(false);

  const option = RESOLVE_OPTIONS.find(o => o.label === selected);
  const isCustomSplit = option?.resolution === 'SPLIT' && option.splitRatio === undefined;

  const splitRatio: number | undefined = isCustomSplit
    ? parseFloat(customRatio) / 100
    : option?.splitRatio;

  const escrowTotal = parseFloat(booking.escrowHeld);
  let vendorPreview   = 0;
  let customerPreview = 0;

  if (option) {
    if (option.resolution === 'RELEASE') {
      vendorPreview   = escrowTotal;
      customerPreview = 0;
    } else if (option.resolution === 'REFUND') {
      vendorPreview   = 0;
      customerPreview = escrowTotal;
    } else if (option.resolution === 'SPLIT' && splitRatio !== undefined && !isNaN(splitRatio)) {
      vendorPreview   = Math.round(escrowTotal * splitRatio * 100) / 100;
      customerPreview = Math.round((escrowTotal - vendorPreview) * 100) / 100;
    }
  }

  async function handleConfirm() {
    if (!option) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/admin/disputes/${booking.bookingId}/resolve`,
        {
          method:      'PUT',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({
            resolution: option.resolution,
            ...(option.resolution === 'SPLIT' && splitRatio !== undefined
              ? { splitRatio }
              : {}),
          }),
        },
      );

      const json = (await res.json()) as { success: boolean; error?: { message?: string } };

      if (!json.success) {
        setError(json.error?.message ?? 'Failed to resolve dispute.');
        return;
      }

      setResolved(true);
      onResolved(booking.bookingId);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (resolved) {
    return (
      <tr className="bg-green-50">
        <td colSpan={7} className="px-4 py-3 text-center text-sm text-green-700 font-medium">
          Dispute resolved
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition">
        <td className="px-4 py-3 text-sm text-[#0F172A] font-mono">
          #{booking.bookingId.slice(0, 8).toUpperCase()}
        </td>
        <td className="px-4 py-3 text-sm text-[#0F172A]">{booking.customerName}</td>
        <td className="px-4 py-3 text-sm text-[#64748B] font-mono">
          {booking.vendorId.slice(0, 8)}
        </td>
        <td className="px-4 py-3 text-sm text-[#0F172A]">{formatInr(booking.totalAmount)}</td>
        <td className="px-4 py-3 text-sm font-semibold text-amber-700">
          {formatInr(booking.escrowHeld)}
        </td>
        <td className="px-4 py-3 text-sm text-[#64748B]">
          {new Date(booking.raisedAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={selected}
              onChange={(e) => { setSelected(e.target.value); setConfirming(false); setError(null); }}
              className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1848C8] focus:outline-none focus:ring-2 focus:ring-[#1848C8]/20"
            >
              <option value="">Select resolution…</option>
              {RESOLVE_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>

            {isCustomSplit && (
              <input
                type="number"
                min="1"
                max="99"
                value={customRatio}
                onChange={(e) => setCustomRatio(e.target.value)}
                placeholder="Vendor %"
                className="min-h-[44px] w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1848C8] focus:outline-none focus:ring-2 focus:ring-[#1848C8]/20"
              />
            )}

            {selected && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={isCustomSplit && (!customRatio || isNaN(parseFloat(customRatio)))}
                className="min-h-[44px] rounded-lg bg-[#0A1F4D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1848C8] disabled:opacity-50"
              >
                Review
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Preview + confirmation row */}
      {confirming && option && (
        <tr className="bg-blue-50 border-b border-blue-100">
          <td colSpan={7} className="px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[#0F172A]">
                <span className="font-semibold">Resolution preview:</span>{' '}
                <span className="text-green-700">Vendor receives {formatInr(vendorPreview)}</span>
                {' · '}
                <span className="text-blue-700">Customer receives {formatInr(customerPreview)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                  className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="min-h-[44px] rounded-lg bg-[#059669] px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? 'Resolving…' : 'Confirm Resolution'}
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
