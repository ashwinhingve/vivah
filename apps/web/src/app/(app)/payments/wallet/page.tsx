/**
 * Smart Shaadi — Wallet Page
 * Server Component
 */
import { cookies } from 'next/headers';
import type { WalletSnapshot, WalletTransaction } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
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

async function fetchTransactions(cookie: string): Promise<WalletTransaction[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/wallet/transactions?limit=50`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: WalletTransaction[] | null };
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const REASON_LABELS: Record<string, string> = {
  REFUND:     'Refund credit',
  PROMO:      'Promo credit',
  REFERRAL:   'Referral bonus',
  CASHBACK:   'Cashback',
  PAYMENT:    'Payment deducted',
  TOPUP:      'Wallet top-up',
  ADJUSTMENT: 'Manual adjustment',
  EXPIRY:     'Balance expired',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WalletPage() {
  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <div className="min-h-screen px-4 py-16 text-center" style={{ background: '#FEFAF6' }}>
        <p className="text-muted-foreground">Please sign in to view your wallet.</p>
      </div>
    );
  }

  const [wallet, transactions] = await Promise.all([
    fetchWallet(cookie),
    fetchTransactions(cookie),
  ]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: '#FEFAF6' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#7B2D42' }}>My Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance, credits, and transaction history
          </p>
        </div>

        {/* Balance card */}
        {wallet ? (
          <div
            className="mb-6 rounded-2xl border p-6 text-center shadow-sm"
            style={{ borderColor: '#C5A47E', background: '#FEF9F0' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Available Balance
            </p>
            <p className="text-4xl font-bold" style={{ color: '#0E7C7B' }}>
              {formatINR(wallet.balance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{wallet.currency}</p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border px-4 py-3" style={{ borderColor: '#C5A47E' }}>
                <p className="text-base font-bold text-green-700">{formatINR(wallet.lifetimeIn)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Total credited</p>
              </div>
              <div className="rounded-xl bg-white border px-4 py-3" style={{ borderColor: '#C5A47E' }}>
                <p className="text-base font-bold" style={{ color: '#7B2D42' }}>{formatINR(wallet.lifetimeOut)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Total debited</p>
              </div>
            </div>

            {!wallet.isActive && (
              <p className="mt-4 text-xs font-medium text-red-600">
                This wallet has been deactivated. Contact support for assistance.
              </p>
            )}
          </div>
        ) : (
          <div
            className="mb-6 rounded-xl border border-dashed py-10 text-center"
            style={{ borderColor: '#C5A47E' }}
          >
            <p className="text-muted-foreground text-sm">Wallet information is not available.</p>
          </div>
        )}

        {/* Transaction ledger */}
        <div>
          <h2 className="mb-3 text-base font-semibold" style={{ color: '#7B2D42' }}>
            Transaction History
          </h2>

          {transactions.length === 0 ? (
            <div
              className="rounded-xl border border-dashed py-12 text-center"
              style={{ borderColor: '#C5A47E' }}
            >
              <p className="text-sm text-muted-foreground">No wallet transactions yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#C5A47E' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: '#FEF9F0' }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Balance after</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#C5A47E22' }}>
                    {transactions.map(txn => (
                      <tr key={txn.id} className="bg-surface hover:bg-gold/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(txn.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-foreground">
                            {REASON_LABELS[txn.reason] ?? txn.reason}
                          </p>
                          {txn.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {txn.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">
                          <span className={txn.type === 'CREDIT' ? 'text-green-700' : 'text-red-700'}>
                            {txn.type === 'CREDIT' ? '+' : '−'}{formatINR(txn.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatINR(txn.balanceAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
