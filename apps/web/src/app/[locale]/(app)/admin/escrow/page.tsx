import { redirect } from '@/i18n/redirect';
import { cookies } from 'next/headers';
import { fetchAuth } from '@/lib/server-fetch';
import { DisputeTableClient } from './DisputeTableClient.client';

export const dynamic = 'force-dynamic';

interface AuthMe { userId: string; role: string; status: string }

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
    return await redirect('/login');
  }
  // Defense-in-depth: middleware fail-opens if /api/auth/me errors, so re-check
  // the role here and redirect any non-admin off the page.
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const wrapped = await fetchAuth<{ disputes: DisputedBookingRow[] }>('/api/v1/admin/disputes');
  const disputes = wrapped?.disputes ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-primary">Escrow Disputes</h1>
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
