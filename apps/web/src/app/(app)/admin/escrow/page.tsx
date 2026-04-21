import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { fetchAuth } from '@/lib/server-fetch';
import { ResolveDisputeRow } from './ResolveDisputeRow.client';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe {
  id:   string;
  role: string;
}

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

async function fetchMe(token: string): Promise<AuthMe | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: AuthMe };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function AdminEscrowPage() {
  // Auth gate
  const cookieStore = await cookies();
  const token       = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    redirect('/login');
  }

  const me = await fetchMe(token);
  if (!me || me.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const disputes = await fetchAuth<DisputedBookingRow[]>('/api/v1/admin/disputes');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1F4D]">Escrow Disputes</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Review and resolve disputed escrow payments
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
          {disputes?.length ?? 0} open
        </span>
      </div>

      {/* Empty state */}
      {(!disputes || disputes.length === 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="font-medium text-[#0F172A]">No disputed bookings</p>
          <p className="mt-1 text-sm text-[#64748B]">
            All escrow disputes have been resolved or none have been raised yet.
          </p>
        </div>
      )}

      {/* Disputes table */}
      {disputes && disputes.length > 0 && (
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
                <DisputeTableBody disputes={disputes} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Thin server wrapper so we can pass a server-rendered list to a client component
// The client component manages optimistic removal after resolve
function DisputeTableBody({ disputes }: { disputes: DisputedBookingRow[] }) {
  return (
    <>
      {disputes.map((booking) => (
        <ResolveDisputeRow
          key={booking.bookingId}
          booking={booking}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onResolved={() => {}}
        />
      ))}
    </>
  );
}
