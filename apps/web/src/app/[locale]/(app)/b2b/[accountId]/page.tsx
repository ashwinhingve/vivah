/**
 * B2B Account Detail Page
 *
 * Shows account information and navigation to contracts/invoices.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import { PageTransition } from '@/components/motion/PageTransition.client';

interface B2BAccountDetailPageProps {
  params: Promise<{
    locale: string;
    accountId: string;
  }>;
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'b2b.detail.metadata' });
  return { title: t('title') };
}

export default async function B2BAccountDetailPage({
  params,
}: B2BAccountDetailPageProps) {
  const { accountId } = await params;
  const t = await getTranslations('b2b.detail');
  const tStatus = await getTranslations('b2b.status');

  // Phase 2: Fetch account from API
  // const { data: account, error } = await fetchAuth<{ account: B2BAccount }>(
  //   `/api/v1/b2b/accounts/${accountId}`
  // );

  const account: B2BAccount | null = null;
  const error: string | null = null;

  if (error) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
            <PageHeader title={t('notFound')} />
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!account) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
            <PageHeader title={t('notFound')} />
            <EmptyState
              title={t('notFound')}
              description={t('notFoundDescription')}
              action={
                <Link href="/b2b">
                  <Button>{t('backButton')}</Button>
                </Link>
              }
            />
          </div>
        </div>
      </PageTransition>
    );
  }

  const acct = account as B2BAccount;
  const statusMap: Record<string, string> = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended',
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
          <PageHeader
            title={acct.legalName}
            subtitle={t('subtitle')}
          />

          {/* Account Information Card */}
          <div className="mb-8 rounded-2xl border border-gold/20 bg-surface p-8 shadow-card">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-heading font-semibold text-primary">{t('accountInfoHeading')}</h2>
              <span className="inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-muted">
                {tStatus(statusMap[acct.status] ?? acct.status)}
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gold-muted">{t('legalNameLabel')}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{acct.legalName}</p>
              </div>

              <div>
                <p className="text-xs text-gold-muted">{t('gstinLabel')}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">{acct.gstin}</p>
              </div>

              {acct.hsnSac && (
                <div>
                  <p className="text-xs text-gold-muted">{t('hsnSacLabel')}</p>
                  <p className="mt-1 font-mono text-sm text-foreground">{acct.hsnSac}</p>
                </div>
              )}

              {acct.contactEmail && (
                <div>
                  <p className="text-xs text-gold-muted">{t('emailLabel')}</p>
                  <p className="mt-1 text-sm text-foreground">{acct.contactEmail}</p>
                </div>
              )}

              {acct.contactPhone && (
                <div>
                  <p className="text-xs text-gold-muted">{t('phoneLabel')}</p>
                  <p className="mt-1 text-sm text-foreground">{acct.contactPhone}</p>
                </div>
              )}

              {acct.billingAddress && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gold-muted">{t('billingAddressLabel')}</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{acct.billingAddress}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-4 border-t border-gold/20 pt-6">
              <Link href={`/b2b/${accountId}/edit`}>
                <Button variant="outline">{t('editButton')}</Button>
              </Link>
            </div>
          </div>

          {/* Navigation to Sub-pages */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href={`/b2b/${accountId}/contracts`}>
              <div className="cursor-pointer rounded-2xl border border-gold/20 bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                <h3 className="text-lg font-heading font-semibold text-primary">{t('contractsHeading')}</h3>
                <p className="mt-2 text-sm text-gold-muted">
                  {t('contractsDescription')}
                </p>
                <div className="mt-4 flex items-center gap-1 text-teal">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </Link>

            <Link href={`/b2b/${accountId}/invoices`}>
              <div className="cursor-pointer rounded-2xl border border-gold/20 bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                <h3 className="text-lg font-heading font-semibold text-primary">{t('invoicesHeading')}</h3>
                <p className="mt-2 text-sm text-gold-muted">{t('invoicesDescription')}</p>
                <div className="mt-4 flex items-center gap-1 text-teal">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
