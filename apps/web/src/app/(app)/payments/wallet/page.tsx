/**
 * Smart Shaadi — Wallet Page
 * Server Component
 */
import { cookies } from 'next/headers';
import type { WalletSnapshot, WalletTransaction } from '@smartshaadi/types';
import {
  Container,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
} from '@/components/shared';
import { cn } from '@/lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchWallet(cookie: string): Promise<WalletSnapshot | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/wallet`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
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
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { items: WalletTransaction[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const REASON_LABELS: Record<string, string> = {
  REFUND: 'Refund credit',
  PROMO: 'Promo credit',
  REFERRAL: 'Referral bonus',
  CASHBACK: 'Cashback',
  PAYMENT: 'Payment deducted',
  TOPUP: 'Wallet top-up',
  ADJUSTMENT: 'Manual adjustment',
  EXPIRY: 'Balance expired',
};

export default async function WalletPage() {
  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <main className="min-h-screen bg-background py-16">
        <Container variant="narrow">
          <EmptyState
            title="Sign in required"
            description="Please sign in to view your wallet."
          />
        </Container>
      </main>
    );
  }

  const [wallet, transactions] = await Promise.all([
    fetchWallet(cookie),
    fetchTransactions(cookie),
  ]);

  const columns: DataTableColumn<WalletTransaction>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (t) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(t.createdAt)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (t) => (
        <div>
          <p className="text-xs font-medium text-foreground">
            {REASON_LABELS[t.reason] ?? t.reason}
          </p>
          {t.description ? (
            <p className="max-w-[180px] truncate text-xs text-muted-foreground">{t.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (t) => (
        <span
          className={cn(
            'whitespace-nowrap text-right text-xs font-semibold',
            t.type === 'CREDIT' ? 'text-success' : 'text-destructive'
          )}
        >
          {t.type === 'CREDIT' ? '+' : '−'}
          {formatINR(t.amount)}
        </span>
      ),
      cellClassName: 'text-right',
      headClassName: 'text-right',
    },
    {
      key: 'balanceAfter',
      header: 'Balance after',
      render: (t) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatINR(t.balanceAfter)}
        </span>
      ),
      cellClassName: 'text-right',
      headClassName: 'text-right',
    },
  ];

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader title="My Wallet" subtitle="Balance, credits, and transaction history" />

        {wallet ? (
          <section className="mb-6 rounded-2xl border border-gold bg-secondary p-6 text-center shadow-card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Available Balance
            </p>
            <p className="text-4xl font-bold text-teal">{formatINR(wallet.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{wallet.currency}</p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gold bg-surface px-4 py-3">
                <p className="text-base font-bold text-success">{formatINR(wallet.lifetimeIn)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Total credited</p>
              </div>
              <div className="rounded-xl border border-gold bg-surface px-4 py-3">
                <p className="text-base font-bold text-primary">{formatINR(wallet.lifetimeOut)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Total debited</p>
              </div>
            </div>

            {!wallet.isActive ? (
              <p className="mt-4 text-xs font-medium text-destructive">
                This wallet has been deactivated. Contact support for assistance.
              </p>
            ) : null}
          </section>
        ) : (
          <EmptyState
            title="Wallet not available"
            description="Wallet information is not available."
            className="mb-6"
          />
        )}

        <h2 className="mb-3 text-base font-semibold text-primary">Transaction History</h2>
        <DataTable
          columns={columns}
          data={transactions}
          rowKey={(t) => t.id}
          empty={{
            title: 'No transactions yet',
            description: 'Your wallet activity will appear here.',
          }}
        />
      </Container>
    </main>
  );
}
