import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { fetchAuth } from '@/lib/server-fetch';
import { DisputeTableClient } from './DisputeTableClient.client';

export const dynamic = 'force-dynamic';

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

export default async function AdminEscrowPage() {
  // Auth gate — rely on middleware for role check, just verify session exists
  const cookieStore = await cookies();
  const token       = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    redirect('/login');
  }

  const wrapped = await fetchAuth<{ disputes: DisputedBookingRow[] }>('/api/v1/admin/disputes');
  const disputes = wrapped?.disputes ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Escrow Disputes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and resolve disputed escrow payments
          </p>
        </div>
      </div>

      {/* Empty state */}
      {(!disputes || disputes.length === 0) && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <p className="font-medium text-foreground">No disputed bookings</p>
          <p className="mt-1 text-sm text-muted-foreground">
            All escrow disputes have been resolved or none have been raised yet.
          </p>
        </div>
      )}

      {/* Disputes table — lifted state for resolved count + toast */}
      {disputes && disputes.length > 0 && (
        <DisputeTableClient disputes={disputes} />
      )}
    </div>
  );
}
