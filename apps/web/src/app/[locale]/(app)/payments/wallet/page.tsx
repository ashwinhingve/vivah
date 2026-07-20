/**
 * Smart Shaadi — Wallet Page
 * Server Component
 */
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { WalletSnapshot, WalletTransaction } from '@smartshaadi/types';
import { Container, DataTable, type DataTableColumn } from '@/components/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
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
  const t = await getTranslations('payments.wallet');
  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <main className="min-h-screen bg-background py-16">
        <Container variant="narrow">
          <EmptyState
            title={t('signInRequired')}
            description={t('signInRequiredDesc')}
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
      header: t('columns.date'),
      render: (tx) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(tx.createdAt)}
        </span>
      ),
    },
    {
      key: 'description',
      header: t('columns.description'),
      render: (tx) => (
        <div>
          <p className="text-xs font-medium text-foreground">
            {REASON_LABELS[tx.reason] ?? tx.reason}
          </p>
          {tx.description ? (
            <p className="max-w-[180px] truncate text-xs text-muted-foreground">{tx.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('columns.amount'),
      render: (tx) => (
        <span
          className={cn(
            'whitespace-nowrap text-right text-xs font-semibold',
            tx.type === 'CREDIT' ? 'text-success' : 'text-destructive'
          )}
        >
          {tx.type === 'CREDIT' ? '+' : '−'}
          {formatINR(tx.amount)}
        </span>
      ),
      cellClassName: 'text-right',
      headClassName: 'text-right',
    },
    {
      key: 'balanceAfter',
      header: t('columns.balanceAfter'),
      render: (tx) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatINR(tx.balanceAfter)}
        </span>
      ),
      cellClassName: 'text-right',
      headClassName: 'text-right',
    },
  ];

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />

        {wallet ? (
          <section className="mb-6 rounded-2xl border border-gold bg-secondary p-6 text-center shadow-card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('balanceLabel')}
            </p>
            <p className="text-4xl font-bold text-teal">{formatINR(wallet.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{wallet.currency}</p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gold bg-surface px-4 py-3 shadow-card">
                <p className="text-base font-bold text-success">{formatINR(wallet.lifetimeIn)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('totalCredited')}</p>
              </div>
              <div className="rounded-xl border border-gold bg-surface px-4 py-3 shadow-card">
                <p className="text-base font-bold text-primary">{formatINR(wallet.lifetimeOut)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('totalDebited')}</p>
              </div>
            </div>

            {!wallet.isActive ? (
              <p className="mt-4 text-xs font-medium text-destructive">
                {t('walletDeactivated')}
              </p>
            ) : null}
          </section>
        ) : (
          <EmptyState
            title={t('walletNotAvailable')}
            description={t('walletNotAvailableDesc')}
            className="mb-6"
          />
        )}

        <h2 className="mb-3 text-base font-semibold text-primary">{t('transactionHistory')}</h2>
        <DataTable
          columns={columns}
          data={transactions}
          rowKey={(tx) => tx.id}
          empty={{
            title: t('noTransactions'),
            description: t('noTransactionsDesc'),
          }}
        />
      </Container>
    </main>
  );
}
