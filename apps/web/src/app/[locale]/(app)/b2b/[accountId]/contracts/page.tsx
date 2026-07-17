/**
 * B2B Contracts Management Page
 *
 * Lists contracts for a B2B account and provides create/send UI.
 * Phase 5 Sprint A: e-sign provider call is stubbed.
 */

import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contracts',
};

interface ContractsPageProps {
  params: {
    locale: string;
    accountId: string;
  };
}

interface Contract {
  id: string;
  templateId: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID';
  provider: 'DIGILOCKER' | 'SIGNZY' | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export default async function ContractsPage({ params: { locale, accountId } }: ContractsPageProps) {
  // Phase 2: Fetch contracts from API
  // const { data: contracts, error } = await fetchAuth<{ contracts: Contract[] }>(
  //   `/api/v1/b2b/contracts?accountId=${accountId}`
  // );

  const contracts: Contract[] = [];
  const isLoading = false;
  const error = null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Contracts"
        subtitle="Create, manage, and sign contract documents"
      />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Failed to load contracts: {error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && contracts.length === 0 && (
          <EmptyState
            variant="no-bookings"
            title="No Contracts Yet"
            description="Create your first contract document for this B2B account."
            action={
              <Link href={`/${locale}/b2b/${accountId}/contracts/create`}>
                <Button>Create Contract</Button>
              </Link>
            }
          />
        )}

        {!isLoading && contracts.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Link href={`/${locale}/b2b/${accountId}/contracts/create`}>
                <Button>Create New Contract</Button>
              </Link>
            </div>

            <div className="grid gap-4">
              {contracts.map((contract) => (
                <ContractCard key={contract.id} contract={contract} locale={locale} accountId={accountId} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-4">
          <Link href={`/${locale}/b2b/${accountId}`}>
            <Button variant="outline">Back to Account</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface ContractCardProps {
  contract: Contract;
  locale: string;
  accountId: string;
}

function ContractCard({ contract, locale, accountId }: ContractCardProps) {
  const statusColors: Record<string, string> = {
    DRAFT: 'bg-blue-100 text-blue-800',
    SENT: 'bg-amber-100 text-amber-800',
    SIGNED: 'bg-emerald-100 text-emerald-800',
    VOID: 'bg-red-100 text-red-800',
  };

  const statusText: Record<string, string> = {
    DRAFT: 'Draft',
    SENT: 'Pending Signature',
    SIGNED: 'Signed',
    VOID: 'Void',
  };

  return (
    <Link href={`/${locale}/b2b/${accountId}/contracts/${contract.id}`}>
      <div className="cursor-pointer rounded-2xl border border-gold bg-white p-6 shadow-card transition-all hover:shadow-card-hover">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-primary">{contract.title}</h3>
            <p className="mt-1 text-xs text-gold-muted">Template: {contract.templateId}</p>
          </div>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColors[contract.status]}`}
          >
            {statusText[contract.status]}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gold-muted">
          <span>Created {new Date(contract.createdAt).toLocaleDateString()}</span>
          {contract.signedAt && <span>Signed {new Date(contract.signedAt).toLocaleDateString()}</span>}
        </div>
      </div>
    </Link>
  );
}
