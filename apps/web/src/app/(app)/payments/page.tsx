/**
 * Smart Shaadi — Payment History Page
 * Server Component — fetches data server-side, no client JS needed.
 *
 * Design: Ivory #FEFAF6 bg, Burgundy #7B2D42 headings, Gold #C5A47E borders
 */
import { cookies } from 'next/headers';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EscrowAccount {
  id:           string;
  bookingId:    string;
  totalHeld:    string;
  released:     string;
  status:       'HELD' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';
  releaseDueAt: string | null;
  releasedAt:   string | null;
}

interface PaymentHistoryItem {
  id:                string;
  bookingId:         string;
  amount:            string;
  currency:          string;
  status:            string;
  razorpayOrderId:   string;
  razorpayPaymentId: string | null;
  createdAt:         string;
  escrow:            EscrowAccount | null;
}

interface PaymentHistoryResponse {
  success: boolean;
  data: {
    items: PaymentHistoryItem[];
    total: number;
    page:  number;
    limit: number;
  } | null;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchPaymentHistory(): Promise<PaymentHistoryResponse['data']> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/history?limit=20`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as PaymentHistoryResponse;
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string;
}

function PaymentStatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PENDING:  { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Pending' },
    CAPTURED: { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Held in Escrow' },
    RELEASED: { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Released' },
    REFUNDED: { bg: 'bg-slate-100',  text: 'text-slate-700',  label: 'Refunded' },
    FAILED:   { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Failed' },
    PARTIALLY_REFUNDED: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Partially Refunded' },
  };

  const style = map[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: status };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

function EscrowStatusBadge({ status }: { status: EscrowAccount['status'] }) {
  const map: Record<EscrowAccount['status'], { bg: string; text: string; label: string }> = {
    HELD:     { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Escrow Held' },
    RELEASED: { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Released to Vendor' },
    DISPUTED: { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Disputed' },
    REFUNDED: { bg: 'bg-slate-50',  text: 'text-slate-600',  label: 'Escrow Refunded' },
  };

  const style = map[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

// ── Payment card ──────────────────────────────────────────────────────────────

interface PaymentCardProps {
  payment: PaymentHistoryItem;
  escrow:  EscrowAccount | null;
}

function PaymentCard({ payment, escrow }: PaymentCardProps) {
  return (
    <div
      className="rounded-xl bg-white shadow-sm border p-5"
      style={{ borderColor: '#C5A47E' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-mono truncate">
            Order: {payment.razorpayOrderId || '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Booking: {payment.bookingId.slice(0, 8)}…
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className="text-lg font-bold"
            style={{ color: '#7B2D42' }}
          >
            {formatINR(payment.amount)}
          </p>
          <p className="text-xs text-slate-400">{payment.currency}</p>
        </div>
      </div>

      {/* Status + escrow row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={payment.status} />
        {escrow && <EscrowStatusBadge status={escrow.status} />}
      </div>

      {/* Escrow detail */}
      {escrow && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: '#FEF9F0', borderLeft: '3px solid #C5A47E' }}
        >
          <span className="font-medium text-slate-700">Escrow: </span>
          <span className="text-slate-600">{formatINR(escrow.totalHeld)} held</span>
          {escrow.status === 'RELEASED' && (
            <span className="ml-2 text-green-700">· {formatINR(escrow.released)} released</span>
          )}
          {escrow.releaseDueAt && escrow.status === 'HELD' && (
            <span className="ml-2 text-slate-500">
              · Release due {formatDate(escrow.releaseDueAt)}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="mt-3 text-xs text-slate-400">
        Created {formatDate(payment.createdAt)}
        {payment.razorpayPaymentId && (
          <span className="ml-2 font-mono">· {payment.razorpayPaymentId}</span>
        )}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsPage() {
  const historyData = await fetchPaymentHistory();
  const payments = historyData?.items ?? [];

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: '#FEFAF6' }}>
      <div className="mx-auto max-w-3xl">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#7B2D42' }}>
            Payment History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your bookings, escrow holdings, and payment records
          </p>
        </div>

        {/* Summary strip */}
        {payments.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            {(
              [
                { label: 'Total Payments', value: payments.length },
                {
                  label: 'In Escrow',
                  value: payments.filter((p) => p.status === 'CAPTURED').length,
                },
                {
                  label: 'Completed',
                  value: payments.filter((p) => p.escrow?.status === 'RELEASED').length,
                },
              ] as const
            ).map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl bg-white shadow-sm border px-4 py-3 text-center"
                style={{ borderColor: '#C5A47E' }}
              >
                <p className="text-xl font-bold" style={{ color: '#7B2D42' }}>
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Payment list */}
        {payments.length === 0 ? (
          /* Empty state */
          <div className="rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#C5A47E' }}>
            <p className="text-4xl">💳</p>
            <p className="mt-3 font-medium" style={{ color: '#7B2D42' }}>
              No payments yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Confirm a booking and make a payment to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                escrow={payment.escrow ?? null}
              />
            ))}
          </div>
        )}

        {/* Escrow explanation */}
        <div
          className="mt-8 rounded-xl border px-5 py-4 text-sm"
          style={{ borderColor: '#C5A47E', background: '#FEF9F0' }}
        >
          <p className="font-semibold" style={{ color: '#7B2D42' }}>
            How Smart Shaadi Escrow Works
          </p>
          <ul className="mt-2 space-y-1 text-slate-600 list-disc list-inside">
            <li>50% of your booking amount is held securely in escrow on payment.</li>
            <li>Funds are released to the vendor 48 hours after your event is completed.</li>
            <li>If there is a dispute, funds are held until resolved by our support team.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
