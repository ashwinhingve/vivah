/**
 * B2B Self-Serve — Account Management Dashboard
 *
 * Lists user's B2B accounts and provides create/view/edit UI.
 * Phase 5 Sprint A: API router UNMOUNTED — UI builds to the contract view.
 * Phase 2 (future): Router mounted, API calls enabled.
 */

import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'B2B Accounts',
  description: 'Manage your business accounts and contracts',
};

interface B2BAccount {
  id: string;
  legalName: string;
  gstin: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
}

interface B2BListPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function B2BListPage({ params }: B2BListPageProps) {
  const { locale } = await params;
  // Phase 2: Fetch accounts from API
  // const { data: accounts, error } = await fetchAuth<{ accounts: B2BAccount[] }>(
  //   `/api/v1/b2b/accounts`
  // );

  const accounts: B2BAccount[] = [];
  const isLoading = false;
  const error = null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="B2B Accounts"
        subtitle="Manage institutional buyer accounts, contracts, and invoices"
      />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Failed to load accounts: {error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && accounts.length === 0 && (
          <EmptyState
            variant="no-bookings"
            title="No B2B Accounts Yet"
            description="Create your first business account to access invoicing and contract management."
            action={
              <Link href={`/${locale}/b2b/create`}>
                <Button>Create B2B Account</Button>
              </Link>
            }
          />
        )}

        {!isLoading && accounts.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Link href={`/${locale}/b2b/create`}>
                <Button>Create New Account</Button>
              </Link>
            </div>

            <div className="grid gap-4">
              {accounts.map((account) => (
                <AccountCard key={account.id} account={account} locale={locale} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface AccountCardProps {
  account: B2BAccount;
  locale: string;
}

function AccountCard({ account, locale }: AccountCardProps) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    VERIFIED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-gray-100 text-gray-800',
  };

  return (
    <Link href={`/${locale}/b2b/${account.id}`}>
      <div className="cursor-pointer rounded-2xl border border-gold bg-white p-6 shadow-card transition-all hover:shadow-card-hover">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-primary">{account.legalName}</h3>
            <p className="mt-1 text-sm text-gold-muted">GSTIN: {account.gstin}</p>
          </div>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColors[account.status]}`}
          >
            {account.status}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gold-muted">
            Created {new Date(account.createdAt).toLocaleDateString()}
          </p>
          <Button variant="ghost" size="sm">
            View Details →
          </Button>
        </div>
      </div>
    </Link>
  );
}
