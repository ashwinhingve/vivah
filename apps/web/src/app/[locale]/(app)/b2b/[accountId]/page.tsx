/**
 * B2B Account Detail Page
 *
 * Shows account information and navigation to contracts/invoices.
 */

import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'B2B Account',
};

interface B2BAccountDetailPageProps {
  params: {
    locale: string;
    accountId: string;
  };
}

interface B2BAccount {
  id: string;
  legalName: string;
  gstin: string;
  hsnSac: string | null;
  billingAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export default async function B2BAccountDetailPage({
  params: { locale, accountId },
}: B2BAccountDetailPageProps) {
  // Phase 2: Fetch account from API
  // const { data: account, error } = await fetchAuth<{ account: B2BAccount }>(
  //   `/api/v1/b2b/accounts/${accountId}`
  // );

  const account: B2BAccount | null = null;
  const error: string | null = null;

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Account Not Found" />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Failed to load account: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Account" />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <EmptyState
            title="Account Not Found"
            description="The B2B account you're looking for doesn't exist."
            action={
              <Link href={`/${locale}/b2b`}>
                <Button>Back to Accounts</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const acct = account as B2BAccount;
  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    VERIFIED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={acct.legalName}
        subtitle="Manage your account, contracts, and invoices"
      />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Account Information Card */}
        <div className="mb-8 rounded-2xl border border-gold bg-white p-8 shadow-card">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-heading font-semibold text-primary">Account Information</h2>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColors[acct.status]}`}
            >
              {acct.status}
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gold-muted">Legal Name</p>
              <p className="mt-1 text-sm font-semibold text-ink">{acct.legalName}</p>
            </div>

            <div>
              <p className="text-xs text-gold-muted">GSTIN</p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">{acct.gstin}</p>
            </div>

            {acct.hsnSac && (
              <div>
                <p className="text-xs text-gold-muted">HSN/SAC Code</p>
                <p className="mt-1 font-mono text-sm text-ink">{acct.hsnSac}</p>
              </div>
            )}

            {acct.contactEmail && (
              <div>
                <p className="text-xs text-gold-muted">Email</p>
                <p className="mt-1 text-sm text-ink">{acct.contactEmail}</p>
              </div>
            )}

            {acct.contactPhone && (
              <div>
                <p className="text-xs text-gold-muted">Phone</p>
                <p className="mt-1 text-sm text-ink">{acct.contactPhone}</p>
              </div>
            )}

            {acct.billingAddress && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gold-muted">Billing Address</p>
                <p className="mt-1 text-sm text-ink whitespace-pre-wrap">{acct.billingAddress}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-4 border-t border-gold pt-6">
            <Link href={`/${locale}/b2b/${accountId}/edit`}>
              <Button variant="outline">Edit Account</Button>
            </Link>
          </div>
        </div>

        {/* Navigation to Sub-pages */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href={`/${locale}/b2b/${accountId}/contracts`}>
            <div className="cursor-pointer rounded-2xl border border-gold bg-white p-6 shadow-card transition-all hover:shadow-card-hover">
              <h3 className="text-lg font-heading font-semibold text-primary">Contracts</h3>
              <p className="mt-2 text-sm text-gold-muted">
                Create, view, and manage contract documents
              </p>
              <div className="mt-4 text-teal">→</div>
            </div>
          </Link>

          <Link href={`/${locale}/b2b/${accountId}/invoices`}>
            <div className="cursor-pointer rounded-2xl border border-gold bg-white p-6 shadow-card transition-all hover:shadow-card-hover">
              <h3 className="text-lg font-heading font-semibold text-primary">Invoices</h3>
              <p className="mt-2 text-sm text-gold-muted">Generate and download GST invoices</p>
              <div className="mt-4 text-teal">→</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
