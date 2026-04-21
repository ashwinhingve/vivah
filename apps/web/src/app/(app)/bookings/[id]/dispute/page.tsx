import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchAuth } from '@/lib/server-fetch';
import { DisputeForm } from './DisputeForm.client';
import type { BookingStatus } from '@smartshaadi/types';

interface BookingDetail {
  id:           string;
  vendorId:     string;
  vendorName:   string;
  eventDate:    string;
  status:       BookingStatus;
  totalAmount:  number;
  escrowAmount: number | null;
}

interface BookingResponse {
  booking: BookingDetail;
}

function formatInr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Only bookings in CONFIRMED or COMPLETED state can be disputed
const DISPUTABLE_STATUSES: BookingStatus[] = ['CONFIRMED', 'COMPLETED'];

export default async function DisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await fetchAuth<BookingResponse>(`/api/v1/bookings/${id}`);

  if (!data?.booking) {
    notFound();
  }

  const booking = data.booking;

  if (!DISPUTABLE_STATUSES.includes(booking.status)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <p className="text-[#0F172A] font-medium">
            This booking cannot be disputed
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Only confirmed or completed bookings can have disputes raised.
          </p>
          <Link
            href={`/bookings/${id}`}
            className="mt-4 inline-block rounded-lg bg-[#0A1F4D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1848C8] transition"
          >
            Back to Booking
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-[#64748B]">
        <Link href="/bookings" className="hover:text-[#1848C8] transition">
          Bookings
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/bookings/${id}`} className="hover:text-[#1848C8] transition">
          Booking Details
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#0F172A] font-medium">Raise Dispute</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0A1F4D]">Raise a Dispute</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Booking #{id.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Booking summary card */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-[#64748B]">Vendor</dt>
            <dd className="font-medium text-[#0F172A]">{booking.vendorName}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Event date</dt>
            <dd className="font-medium text-[#0F172A]">
              {new Date(booking.eventDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Total amount</dt>
            <dd className="font-medium text-[#0F172A]">{formatInr(booking.totalAmount)}</dd>
          </div>
          {booking.escrowAmount != null && (
            <div>
              <dt className="text-[#64748B]">Escrow held</dt>
              <dd className="font-semibold text-amber-700">{formatInr(booking.escrowAmount)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Dispute form (client component) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DisputeForm bookingId={id} />
      </div>
    </div>
  );
}
