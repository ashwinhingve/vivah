/**
 * B2B Self-Serve — Account Management Dashboard
 *
 * Lists user's B2B accounts and provides create/view/edit UI.
 * Phase 5 Sprint A: API router UNMOUNTED — UI builds to the contract view.
 * Phase 2 (future): Router mounted, API calls enabled.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/motion/StaggerList.client';

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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'b2b.list.metadata' });
  return { title: t('title') };
}

export default async function B2BListPage({ params }: B2BListPageProps) {
  const { locale } = await params;
  const t = await getTranslations('b2b.list');

  // Phase 2: Fetch accounts from API
  // const { data: accounts, error } = await fetchAuth<{ accounts: B2BAccount[] }>(
  //   `/api/v1/b2b/accounts`
  // );

  const accounts: B2BAccount[] = [];
  const error = null;

  const createCta = (
    <Link href="/b2b/create">
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
            actions={accounts.length > 0 ? createCta : undefined}
          />

          {error && (
            <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{t('loadError')}</p>
            </div>
          )}

          {accounts.length === 0 && (
            <EmptyState
              variant="no-bookings"
              title={t('emptyTitle')}
              description={t('emptyDescription')}
              action={createCta}
            />
          )}

          {accounts.length > 0 && (
            <StaggerList className="grid gap-4">
              {accounts.map((account) => (
                <AccountCard key={account.id} account={account} locale={locale} />
              ))}
            </StaggerList>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

interface AccountCardProps {
  account: B2BAccount;
  locale: string;
}

function AccountCard({ account, locale }: AccountCardProps) {
  const statusMap: Record<string, string> = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended',
  };

  return (
    <Link href={`/b2b/${account.id}`}>
      <div className="cursor-pointer rounded-2xl border border-gold/20 bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-primary">{account.legalName}</h3>
            <p className="mt-1 text-sm text-gold-muted">GSTIN: {account.gstin}</p>
          </div>
          <span className="inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-muted">
            {statusMap[account.status]}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gold-muted">
            Created {new Date(account.createdAt).toLocaleDateString()}
          </p>
          <Button variant="ghost" size="sm" className="gap-1">
            View Details
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
