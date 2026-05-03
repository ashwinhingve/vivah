/**
 * Smart Shaadi — Vendor Payout History
 * Server Component
 */
import { cookies } from 'next/headers';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';
import { Container, EmptyState, PageHeader } from '@/components/shared';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface VendorPayoutSummary {
  lifetimePaid: string;
  pending: string;
  failed: string;
  payoutCount: number;
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
      cache: 'no-store',
    });
    if (!res.ok) return [];
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
      cache: 'no-store',
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
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_BADGE: Record<PayoutStatus, { className: string; label: string }> = {
  SCHEDULED: { className: 'bg-warning/15 text-warning', label: 'Scheduled' },
  PROCESSING: { className: 'bg-teal/10 text-teal', label: 'Processing' },
  COMPLETED: { className: 'bg-success/15 text-success', label: 'Completed' },
  FAILED: { className: 'bg-destructive/15 text-destructive', label: 'Failed' },
  ON_HOLD: { className: 'bg-warning/20 text-warning', label: 'On Hold' },
};

export default async function VendorPayoutsPage() {
  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <main className="min-h-screen bg-background py-16">
        <Container variant="narrow">
          <EmptyState
            title="Sign in required"
            description="Please sign in to view your payouts."
          />
        </Container>
      </main>
    );
  }

  const [payouts, summary] = await Promise.all([fetchPayouts(cookie), fetchSummary(cookie)]);

  const summaryItems = summary
    ? [
        { label: 'Lifetime Paid', value: formatINR(summary.lifetimePaid), tone: 'text-success' },
        { label: 'Pending', value: formatINR(summary.pending), tone: 'text-warning' },
        { label: 'Failed', value: formatINR(summary.failed), tone: 'text-destructive' },
        { label: 'Total Payouts', value: summary.payoutCount.toString(), tone: 'text-teal' },
      ]
    : null;

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader
          title="My Payouts"
          subtitle="Track your earnings and payout disbursements"
        />

        {summaryItems ? (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-gold bg-surface px-4 py-4 text-center shadow-card"
              >
                <p className={`text-xl font-bold ${item.tone}`}>{item.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {payouts.length === 0 ? (
          <EmptyState
            title="No payouts yet"
            description="Payouts are processed after your bookings are completed and the escrow period ends."
          />
        ) : (
          <ul className="space-y-4">
            {payouts.map((payout) => {
              const badge =
                STATUS_BADGE[payout.status] ?? {
                  className: 'bg-secondary text-muted-foreground',
                  label: payout.status,
                };
              return (
                <li
                  key={payout.id}
                  className="rounded-xl border border-gold bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {payout.bookingId ? (
                        <p className="font-mono text-xs text-muted-foreground">
                          Booking {payout.bookingId.slice(0, 8)}…
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Scheduled {formatDate(payout.scheduledFor)}
                        {payout.processedAt
                          ? ` · Processed ${formatDate(payout.processedAt)}`
                          : ''}
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
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {payout.razorpayPayoutId ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {payout.razorpayPayoutId}
                      </span>
                    ) : null}
                  </div>

                  {payout.failureReason ? (
                    <p className="mt-2 text-xs text-destructive">
                      Reason: {payout.failureReason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <aside className="mt-8 rounded-xl border border-gold bg-secondary px-5 py-4 text-sm">
          <p className="font-semibold text-primary">Payout Schedule</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              Payouts are initiated 48 hours after your event is marked complete by the customer.
            </li>
            <li>Funds arrive in your registered bank account within 3–5 business days.</li>
            <li>Platform fees of 5–10% are deducted before disbursement.</li>
          </ul>
        </aside>
      </Container>
    </main>
  );
}
