/**
 * Smart Shaadi — Payment History Page
 * Server Component — fetches data server-side, no client JS needed for static content.
 */
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PaymentSummaryCard } from '@/components/payments/PaymentSummaryCard';
import { PaymentsPageClient } from '@/components/payments/PaymentsPageClient.client';

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
  invoiceId:         string | null;
  createdAt:         string;
  escrow:            EscrowAccount | null;
}

interface WalletSnapshot {
  balance:     string;
  lifetimeIn:  string;
  lifetimeOut: string;
  currency:    string;
  isActive:    boolean;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchPaymentHistory(cookie: string): Promise<PaymentHistoryItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/history?limit=50`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { items: PaymentHistoryItem[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

async function fetchWallet(cookie: string): Promise<WalletSnapshot | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/wallet`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: WalletSnapshot | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsPage() {
  const cookie = await getAuthHeader();
  if (!cookie) {
    return (
      <div className="min-h-screen px-4 py-16 text-center" style={{ background: '#FEFAF6' }}>
        <p className="text-muted-foreground">Please sign in to view your payment history.</p>
      </div>
    );
  }

  const [payments, wallet] = await Promise.all([
    fetchPaymentHistory(cookie),
    fetchWallet(cookie),
  ]);

  const totalSpend = payments
    .filter(p => p.status === 'CAPTURED' || p.status === 'RELEASED')
    .reduce((acc, p) => acc + parseFloat(p.amount), 0);

  const totalRefunded = payments
    .filter(p => p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED')
    .reduce((acc, p) => acc + parseFloat(p.amount), 0);

  const walletBalance = wallet ? parseFloat(wallet.balance) : 0;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: '#FEFAF6' }}>
      <div className="mx-auto max-w-3xl">
        {/* Page heading */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#7B2D42' }}>
              Payment History
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your bookings, wallet, and payment records
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/payments/wallet"
              className="inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-gold/10"
              style={{ borderColor: '#C5A47E', color: '#7B2D42' }}
            >
              Wallet
            </Link>
            <Link
              href="/payments/refunds"
              className="inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-gold/10"
              style={{ borderColor: '#C5A47E', color: '#7B2D42' }}
            >
              Refunds
            </Link>
          </div>
        </div>

        {/* Summary card */}
        <div className="mb-6">
          <PaymentSummaryCard
            totalSpend={totalSpend}
            totalRefunded={totalRefunded}
            walletBalance={walletBalance}
          />
        </div>

        {/* Filter tabs + payment list (client) */}
        <PaymentsPageClient payments={payments} />

        {/* Escrow explanation */}
        <div
          className="mt-8 rounded-xl border px-5 py-4 text-sm"
          style={{ borderColor: '#C5A47E', background: '#FEF9F0' }}
        >
          <p className="font-semibold" style={{ color: '#7B2D42' }}>
            How Smart Shaadi Escrow Works
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
            <li>50% of your booking amount is held securely in escrow on payment.</li>
            <li>Funds are released to the vendor 48 hours after your event is completed.</li>
            <li>If there is a dispute, funds are held until resolved by our support team.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
