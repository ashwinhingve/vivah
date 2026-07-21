/**
 * B2B Contracts Management Page
 *
 * Lists contracts for a B2B account and provides create/send UI.
 * Phase 5 Sprint A: e-sign provider call is stubbed.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { Link } from '@/i18n/navigation';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/motion/StaggerList.client';

interface ContractsPageProps {
  params: Promise<{
    locale: string;
    accountId: string;
  }>;
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'b2b.contracts.metadata' });
  return { title: t('title') };
}

export default async function ContractsPage({ params }: ContractsPageProps) {
  const { accountId } = await params;
  const t = await getTranslations('b2b.contracts');
  const tStatus = await getTranslations('b2b.status');

  // Phase 2: Fetch contracts from API
  // const { data: contracts, error } = await fetchAuth<{ contracts: Contract[] }>(
  //   `/api/v1/b2b/contracts?accountId=${accountId}`
  // );

  const contracts: Contract[] = [];
  const error = null;

  const createCta = (
    <Link href={`/b2b/${accountId}/contracts/create`}>
      <Button>{t('createButton')}</Button>
    </Link>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
            actions={contracts.length > 0 ? createCta : undefined}
          />

          {error && (
            <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{t('loadError')}</p>
            </div>
          )}

          {contracts.length === 0 && (
            <EmptyState
              variant="no-bookings"
              title={t('emptyTitle')}
              description={t('emptyDescription')}
              action={createCta}
            />
          )}

          {contracts.length > 0 && (
            <div className="space-y-6">
              <StaggerList className="grid gap-4">
                {contracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} accountId={accountId} t={t} tStatus={tStatus} />
                ))}
              </StaggerList>

              <div className="flex gap-4">
                <Link href={`/b2b/${accountId}`}>
                  <Button variant="outline">{t('backButton')}</Button>
                </Link>
              </div>
            </div>
          )}

          {contracts.length === 0 && (
            <div className="mt-8 flex gap-4">
              <Link href={`/b2b/${accountId}`}>
                <Button variant="outline">{t('backButton')}</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

interface ContractCardProps {
  contract: Contract;
  accountId: string;
  t: (key: string) => string;
  tStatus: (key: string) => string;
}

function ContractCard({ contract, accountId, t, tStatus }: ContractCardProps) {
  const statusMap: Record<string, string> = {
    DRAFT: 'draft',
    SENT: 'sent',
    SIGNED: 'signed',
    VOID: 'void',
  };

  const toneMap: Record<Contract['status'], StatusTone> = {
    DRAFT: 'neutral',
    SENT: 'warning',
    SIGNED: 'success',
    VOID: 'error',
  };

  return (
    <Link href={`/b2b/${accountId}/contracts/${contract.id}`}>
      <div className="cursor-pointer rounded-2xl border border-gold/20 bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-primary">{contract.title}</h3>
            <p className="mt-1 text-xs text-gold-muted">{t('templateLabel')}: {contract.templateId}</p>
          </div>
          <StatusChip tone={toneMap[contract.status]}>
            {tStatus(statusMap[contract.status] ?? contract.status)}
          </StatusChip>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gold-muted">
          <span>{t('createdLabel')} {new Date(contract.createdAt).toLocaleDateString()}</span>
          {contract.signedAt && <span>{t('signedLabel')} {new Date(contract.signedAt).toLocaleDateString()}</span>}
        </div>
      </div>
    </Link>
  );
}
