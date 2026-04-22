'use client';

import { useState } from 'react';
import { ResolveDisputeRow } from './ResolveDisputeRow.client';

interface DisputedBookingRow {
  bookingId:    string;
  customerId:   string;
  customerName: string;
  vendorId:     string;
  totalAmount:  string;
  escrowHeld:   string;
  raisedAt:     string;
  escrowStatus: string;
  paymentId:    string | null;
}

interface Props {
  disputes: DisputedBookingRow[];
}

export function DisputeTableClient({ disputes }: Props) {
  const [resolvedCount, setResolvedCount] = useState(0);
  const [toast, setToast]                 = useState<string | null>(null);

  const openCount = disputes.length - resolvedCount;

  function handleResolved(bookingId: string) {
    setResolvedCount((prev) => prev + 1);
    setToast(`Dispute for booking #${bookingId.slice(0, 8).toUpperCase()} resolved`);
    // Auto-dismiss toast after 4 seconds
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      {/* Open count badge — updates as disputes are resolved */}
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
          {openCount} open
        </span>
        {resolvedCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
            {resolvedCount} resolved this session
          </span>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-sm"
        >
          <span className="font-semibold">Done:</span> {toast}
        </div>
      )}

      {/* Disputes table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Mobile scroll hint */}
        <div className="block sm:hidden px-4 py-2 text-xs text-[#64748B] bg-gray-50 border-b border-gray-100">
          Scroll right to see all columns →
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Booking
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Customer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Vendor
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Escrow Held
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Raised At
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Resolve
                </th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((booking) => (
                <ResolveDisputeRow
                  key={booking.bookingId}
                  booking={booking}
                  onResolved={handleResolved}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
