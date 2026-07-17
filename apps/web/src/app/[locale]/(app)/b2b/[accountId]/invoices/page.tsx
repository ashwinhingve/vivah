/**
 * B2B Invoices Page
 *
 * Lists and generates GST invoices for a B2B account.
 * PDFs render with "Rs." prefix and brand colors (Burgundy, Gold).
 */

import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Invoices',
};

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

export default async function InvoicesPage({ params }: InvoicesPageProps) {
  const { locale, accountId } = await params;
  // Phase 2: Fetch invoices from API
  // const { data: invoices, error } = await fetchAuth<{ invoices: Invoice[] }>(
  //   `/api/v1/b2b/accounts/${accountId}/invoices`
  // );

  const invoices: Invoice[] = [];
  const isLoading = false;
  const error = null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Invoices"
        subtitle="Generate and download GST-compliant invoices"
      />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 rounded-lg border border-teal bg-teal/5 p-4">
          <p className="text-sm text-ink">
            Invoices are generated with GST calculation (CGST+SGST for intra-state,
            IGST for inter-state) and rendered as PDF with "Rs." prefix.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Failed to load invoices: {error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && invoices.length === 0 && (
          <EmptyState
            variant="no-bookings"
            title="No Invoices Yet"
            description="Generate your first invoice for this B2B account."
            action={
              <Link href={`/${locale}/b2b/${accountId}/invoices/generate`}>
                <Button>Generate Invoice</Button>
              </Link>
            }
          />
        )}

        {!isLoading && invoices.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Link href={`/${locale}/b2b/${accountId}/invoices/generate`}>
                <Button>Generate New Invoice</Button>
              </Link>
            </div>

            <div className="grid gap-4">
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
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

interface InvoiceCardProps {
  invoice: Invoice;
}

function InvoiceCard({ invoice }: InvoiceCardProps) {
  const statusColors: Record<string, string> = {
    DRAFT: 'bg-blue-100 text-blue-800',
    ISSUED: 'bg-emerald-100 text-emerald-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const statusText: Record<string, string> = {
    DRAFT: 'Draft',
    ISSUED: 'Issued',
    CANCELLED: 'Cancelled',
  };

  return (
    <div className="rounded-2xl border border-gold bg-white p-6 shadow-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold text-primary">{invoice.invoiceNo}</h3>
          <p className="mt-1 text-sm text-gold-muted">Rs. {invoice.totalAmount.toFixed(2)}</p>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColors[invoice.status]}`}
        >
          {statusText[invoice.status]}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gold-muted">
          {invoice.issuedAt
            ? `Issued ${new Date(invoice.issuedAt).toLocaleDateString()}`
            : `Created ${new Date(invoice.createdAt).toLocaleDateString()}`}
        </p>
        <div className="flex gap-2">
          {invoice.status === 'ISSUED' && (
            <Button variant="ghost" size="sm">
              Download PDF
            </Button>
          )}
          <Button variant="ghost" size="sm">
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}
