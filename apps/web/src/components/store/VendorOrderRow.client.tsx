'use client';

import { useState } from 'react';
import type { VendorOrderItem } from '@smartshaadi/types';

interface VendorOrderRowProps {
  item: VendorOrderItem;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const statusBadge: Record<
  string,
  { text: string; cls: string }
> = {
  PENDING:   { text: 'Pending',   cls: 'text-amber-700 bg-amber-50 border border-amber-200' },
  SHIPPED:   { text: 'Shipped',   cls: 'text-purple-700 bg-purple-50 border border-purple-200' },
  DELIVERED: { text: 'Delivered', cls: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
};

export function VendorOrderRow({ item }: VendorOrderRowProps) {
  const [status, setStatus] = useState(item.fulfilmentStatus);
  const [tracking, setTracking] = useState(item.trackingNumber ?? '');
  const [showShipForm, setShowShipForm] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badge = statusBadge[status] ?? { text: status, cls: 'text-[#64748B] bg-gray-50 border border-gray-200' };

  async function markShipped() {
    if (!tracking.trim()) {
      setError('Please enter a tracking number.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/order-items/${item.id}/ship`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trackingNumber: tracking.trim() }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? 'Failed to mark as shipped.');
        return;
      }
      setStatus('SHIPPED');
      setShowShipForm(false);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function markDelivered() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/order-items/${item.id}/deliver`, {
        method: 'PUT',
        credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? 'Failed to mark as delivered.');
        return;
      }
      setStatus('DELIVERED');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-hidden">
      {/* Main row */}
      <div className="px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: product + customer info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading text-[#7B2D42] font-semibold text-sm truncate max-w-[200px]">
              {item.productName}
            </h3>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}
            >
              {badge.text}
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            Customer: <span className="font-medium text-[#0F172A]">{item.customerName}</span>
          </p>
          <p className="text-xs text-[#64748B]">
            Ordered:{' '}
            <span className="font-medium text-[#0F172A]">
              {new Date(item.orderDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
          {item.trackingNumber && (
            <p className="text-xs text-[#64748B]">
              Tracking: <span className="font-mono text-[#0F172A] text-[11px]">{item.trackingNumber}</span>
            </p>
          )}
        </div>

        {/* Right: qty + price */}
        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:gap-1 shrink-0">
          <p className="text-sm font-semibold text-[#0E7C7B]">
            ₹{item.subtotal.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-[#64748B]">
            {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Actions row */}
      <div className="border-t border-[#C5A47E]/10 px-4 py-2.5 flex flex-wrap items-center gap-2">
        {/* Show address toggle */}
        <button
          type="button"
          onClick={() => setShowAddress((v) => !v)}
          className="text-xs text-[#64748B] hover:text-[#0F172A] underline underline-offset-2 min-h-[44px] flex items-center"
        >
          {showAddress ? 'Hide address' : 'Show shipping address'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {status === 'PENDING' && (
            <button
              type="button"
              onClick={() => setShowShipForm((v) => !v)}
              className="text-xs font-semibold text-white bg-[#7B2D42] px-3 py-1.5 min-h-[44px] rounded-lg hover:bg-[#7B2D42]/90 transition-colors"
            >
              Mark Shipped
            </button>
          )}
          {status === 'SHIPPED' && (
            <button
              type="button"
              onClick={markDelivered}
              disabled={loading}
              className="text-xs font-semibold text-white bg-[#0E7C7B] px-3 py-1.5 min-h-[44px] rounded-lg hover:bg-[#0E7C7B]/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Mark Delivered'}
            </button>
          )}
        </div>
      </div>

      {/* Ship form (expandable) */}
      {showShipForm && status === 'PENDING' && (
        <div className="border-t border-[#C5A47E]/10 px-4 py-3 bg-[#FEFAF6] flex flex-col gap-2">
          <label
            htmlFor={`track-${item.id}`}
            className="text-xs font-semibold text-[#64748B] uppercase tracking-wide"
          >
            Tracking Number
          </label>
          <div className="flex gap-2">
            <input
              id={`track-${item.id}`}
              type="text"
              className="flex-1 rounded-lg border border-[#C5A47E]/30 bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0E7C7B] focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]/40 transition-colors"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. DTDC123456789"
            />
            <button
              type="button"
              onClick={markShipped}
              disabled={loading}
              className="shrink-0 text-xs font-semibold text-white bg-[#0E7C7B] px-4 py-2 min-h-[44px] rounded-lg hover:bg-[#0E7C7B]/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* Error outside ship form */}
      {error && !showShipForm && (
        <div className="border-t border-red-100 px-4 py-2 bg-red-50">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Shipping address (expandable) */}
      {showAddress && (
        <div className="border-t border-[#C5A47E]/10 px-4 py-3 bg-[#FEFAF6]">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">
            Shipping Address
          </p>
          <address className="not-italic text-xs text-[#0F172A] space-y-0.5">
            <p className="font-medium">{item.shippingAddress.name}</p>
            <p>{item.shippingAddress.address}</p>
            <p>
              {item.shippingAddress.city}, {item.shippingAddress.state}{' '}
              {item.shippingAddress.pincode}
            </p>
            <p className="text-[#64748B]">{item.shippingAddress.phone}</p>
          </address>
        </div>
      )}
    </div>
  );
}
