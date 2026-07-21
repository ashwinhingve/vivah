/**
 * B2B Invoices Page
 *
 * Lists and generates GST invoices for a B2B account.
 * PDFs render with "Rs." prefix and brand colors (Burgundy, Gold).
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

interface InvoicesPageProps {
  params: Promise<{
    locale: string;
    accountId: string;
  }>;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  totalAmount: number; // in rupees
  createdAt: string;
  issuedAt: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'b2b.invoices.metadata' });
  return { title: t('title') };
}

export default async function InvoicesPage({ params }: InvoicesPageProps) {
  const { accountId } = await params;
  const t = await getTranslations('b2b.invoices');
  const tStatus = await getTranslations('b2b.status');

  // Phase 2: Fetch invoices from API
  // const { data: invoices, error } = await fetchAuth<{ invoices: Invoice[] }>(
  //   `/api/v1/b2b/accounts/${accountId}/invoices`
  // );

  const invoices: Invoice[] = [];
  const error = null;

  const generateCta = (
    <Link href={`/b2b/${accountId}/invoices/generate`}>
      <Button>{t('generateButton')}</Button>
    </Link>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
            actions={invoices.length > 0 ? generateCta : undefined}
          />

          <div className="mb-6 rounded-lg border border-teal bg-teal/5 p-4">
            <p className="text-sm text-foreground">
              {t('infoText')}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{t('loadError')}</p>
            </div>
          )}

          {invoices.length === 0 && (
            <EmptyState
              variant="no-bookings"
              title={t('emptyTitle')}
              description={t('emptyDescription')}
              action={generateCta}
            />
          )}

          {invoices.length > 0 && (
            <div className="space-y-6">
              <StaggerList className="grid gap-4">
                {invoices.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} tStatus={tStatus} t={t} />
                ))}
              </StaggerList>

              <div className="flex gap-4">
                <Link href={`/b2b/${accountId}`}>
                  <Button variant="outline">{t('backButton')}</Button>
                </Link>
              </div>
            </div>
          )}

          {invoices.length === 0 && (
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

interface InvoiceCardProps {
  invoice: Invoice;
  tStatus: (key: string) => string;
  t: (key: string) => string;
}

function InvoiceCard({ invoice, tStatus, t }: InvoiceCardProps) {
  const statusMap: Record<string, string> = {
    DRAFT: 'draft',
    ISSUED: 'issued',
    CANCELLED: 'cancelled',
  };

  const toneMap: Record<Invoice['status'], StatusTone> = {
    DRAFT: 'neutral',
    ISSUED: 'success',
    CANCELLED: 'error',
  };

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold text-primary">{invoice.invoiceNo}</h3>
          <p className="mt-1 text-sm text-gold-muted">Rs. {invoice.totalAmount.toFixed(2)}</p>
        </div>
        <StatusChip tone={toneMap[invoice.status]}>
          {tStatus(statusMap[invoice.status] ?? invoice.status)}
        </StatusChip>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-xs text-gold-muted">
          {invoice.issuedAt
            ? `${t('issued')} ${new Date(invoice.issuedAt).toLocaleDateString()}`
            : `${t('created')} ${new Date(invoice.createdAt).toLocaleDateString()}`}
        </p>
        <div className="flex gap-2">
          {invoice.status === 'ISSUED' && (
            <Button variant="ghost" size="sm">
              {t('downloadPdf')}
            </Button>
          )}
          <Button variant="ghost" size="sm">
            {t('viewDetails')}
          </Button>
        </div>
      </div>
    </div>
  );
}
