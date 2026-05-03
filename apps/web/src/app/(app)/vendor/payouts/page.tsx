/**
 * Smart Shaadi — Vendor Payout History
 * Server Component
 */
import { cookies } from 'next/headers';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface VendorPayoutSummary {
  lifetimePaid:   string;
  pending:        string;
  failed:         string;
  payoutCount:    number;
}

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchPayouts(cookie: string): Promise<PayoutRecord[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/payouts/vendor/mine?limit=50`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API envelope: { success, data: { items: [...] } }
    const json = (await res.json()) as {
      success: boolean;
      data: { items: PayoutRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

async function fetchSummary(cookie: string): Promise<VendorPayoutSummary | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/payouts/vendor/summary`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: VendorPayoutSummary | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_BADGE: Record<PayoutStatus, { bg: string; text: string; label: string }> = {
  SCHEDULED:  { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Scheduled' },
  PROCESSING: { bg: 'bg-teal/10',   text: 'text-teal',   label: 'Processing' },
  COMPLETED:  { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Completed' },
  FAILED:     { bg: 'bg-destructive/15',    text: 'text-destructive',    label: 'Failed' },
  ON_HOLD:    { bg: 'bg-orange-100', text: 'text-orange-700', label: 'On Hold' },
};

export default async function VendorPayoutsPage() {
  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <div className="min-h-screen px-4 py-16 text-center bg-background">
        <p className="text-muted-foreground">Please sign in to view your payouts.</p>
      </div>
    );
  }

  const [payouts, summary] = await Promise.all([
    fetchPayouts(cookie),
    fetchSummary(cookie),
  ]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">My Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your earnings and payout disbursements
          </p>
        </div>

        {/* Summary card */}
        {summary ? (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Lifetime Paid',  value: formatINR(summary.lifetimePaid), color: '#059669' },
              { label: 'Pending',        value: formatINR(summary.pending),       color: '#D97706' },
              { label: 'Failed',         value: formatINR(summary.failed),        color: '#DC2626' },
              { label: 'Total Payouts',  value: summary.payoutCount.toString(),   color: '#0E7C7B' },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-xl bg-surface border shadow-sm px-4 py-4 text-center border-gold"
              >
                <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Payout list */}
        {payouts.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center border-gold">
            <p className="font-medium text-primary">No payouts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Payouts are processed after your bookings are completed and the escrow period ends.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payouts.map(payout => {
              const badge = STATUS_BADGE[payout.status] ?? { bg: 'bg-secondary', text: 'text-muted-foreground', label: payout.status };
              return (
                <div
                  key={payout.id}
                  className="rounded-xl bg-surface border shadow-sm p-5 border-gold"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {payout.bookingId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Booking {payout.bookingId.slice(0, 8)}…
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Scheduled {formatDate(payout.scheduledFor)}
                        {payout.processedAt && ` · Processed ${formatDate(payout.processedAt)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-success">
                        {formatINR(payout.netAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Gross {formatINR(payout.grossAmount)} − {formatINR(payout.platformFee)} fee
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {payout.razorpayPayoutId && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {payout.razorpayPayoutId}
                      </span>
                    )}
                  </div>

                  {payout.failureReason && (
                    <p className="mt-2 text-xs text-destructive">
                      Reason: {payout.failureReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Payout policy note */}
        <div
          className="mt-8 rounded-xl border px-5 py-4 text-sm border-gold bg-secondary"
        >
          <p className="font-semibold text-primary">Payout Schedule</p>
          <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
            <li>Payouts are initiated 48 hours after your event is marked complete by the customer.</li>
            <li>Funds arrive in your registered bank account within 3–5 business days.</li>
            <li>Platform fees of 5–10% are deducted before disbursement.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
