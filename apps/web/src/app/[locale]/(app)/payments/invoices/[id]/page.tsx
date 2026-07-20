/**
 * Smart Shaadi — Invoice Detail Page
 * Server Component — print-friendly GST invoice view.
 */
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { PrintInvoiceButton } from '@/components/payments/PrintInvoiceButton.client';
import type { InvoiceRecord } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchInvoice(id: string): Promise<InvoiceRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/invoices/${id}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: InvoiceRecord | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations('payments.invoiceDetail');
  const { id } = await params;
  const invoice = await fetchInvoice(id);
  if (!invoice) notFound();

  const hasCgst = parseFloat(invoice.cgst) > 0;
  const hasSgst = parseFloat(invoice.sgst) > 0;
  const hasIgst = parseFloat(invoice.igst) > 0;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 print:p-0 bg-background">
      <div className="mx-auto max-w-3xl">
        {/* Back link — hidden on print */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            href="/payments/invoices"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline text-teal min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('backToInvoices')}
          </Link>
          <PrintInvoiceButton />
        </div>

        {/* Invoice document */}
        <div className="rounded-2xl border bg-surface shadow-sm print:shadow-none print:rounded-none border-gold">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gold">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-bold text-primary">Smart Shaadi</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('companyName')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('taxInvoice')}</p>
                <p className="mt-1 font-mono text-sm font-bold text-foreground">{invoice.invoiceNo}</p>
                <p className="text-xs text-muted-foreground">{formatDate(invoice.issuedAt)}</p>
              </div>
            </div>
          </div>

          {/* Bill from / to */}
          <div className="grid grid-cols-2 gap-6 px-8 py-6 border-b border-gold">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('billFrom')}</p>
              <p className="text-sm font-medium text-foreground">{invoice.vendorName ?? t('smartShaadi')}</p>
              {invoice.vendorGstin && (
                <p className="text-xs text-muted-foreground mt-0.5">GSTIN: {invoice.vendorGstin}</p>
              )}
              {invoice.placeOfSupply && (
                <p className="text-xs text-muted-foreground mt-0.5">{t('placeOfSupply')}: {invoice.placeOfSupply}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('billTo')}</p>
              <p className="text-sm font-medium text-foreground">{invoice.customerName}</p>
              {invoice.customerGstin && (
                <p className="text-xs text-muted-foreground mt-0.5">GSTIN: {invoice.customerGstin}</p>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 py-6 border-b overflow-x-auto border-gold">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gold">
                  <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">{t('description')}</th>
                  {invoice.hsnCode && (
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">HSN</th>
                  )}
                  <th className="pb-2 text-right text-xs font-semibold text-muted-foreground">{t('quantity')}</th>
                  <th className="pb-2 text-right text-xs font-semibold text-muted-foreground">{t('rate')}</th>
                  <th className="pb-2 text-right text-xs font-semibold text-muted-foreground">{t('taxPercent')}</th>
                  <th className="pb-2 text-right text-xs font-semibold text-muted-foreground">{t('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-0 border-gold/15">
                    <td className="py-2.5 text-xs text-foreground pr-4">{item.description}</td>
                    {invoice.hsnCode && (
                      <td className="py-2.5 text-xs text-muted-foreground font-mono">{item.hsnCode ?? '—'}</td>
                    )}
                    <td className="py-2.5 text-xs text-right text-foreground">{item.quantity}</td>
                    <td className="py-2.5 text-xs text-right text-foreground whitespace-nowrap">
                      {formatINR(item.unitPrice)}
                    </td>
                    <td className="py-2.5 text-xs text-right text-foreground">{item.taxRate}%</td>
                    <td className="py-2.5 text-xs text-right font-medium text-foreground whitespace-nowrap">
                      {formatINR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 py-6">
            <div className="ml-auto max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('subtotal')}</span>
                <span className="text-foreground">{formatINR(invoice.subtotal)}</span>
              </div>
              {parseFloat(invoice.discount) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t('discount')}</span>
                  <span className="text-success">−{formatINR(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('taxableValue')}</span>
                <span className="text-foreground">{formatINR(invoice.taxableValue)}</span>
              </div>
              {hasCgst && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>CGST</span>
                  <span className="text-foreground">{formatINR(invoice.cgst)}</span>
                </div>
              )}
              {hasSgst && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>SGST</span>
                  <span className="text-foreground">{formatINR(invoice.sgst)}</span>
                </div>
              )}
              {hasIgst && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>IGST</span>
                  <span className="text-foreground">{formatINR(invoice.igst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('totalTax')}</span>
                <span className="text-foreground">{formatINR(invoice.totalTax)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold border-gold text-primary">
                <span>{t('total')}</span>
                <span>{formatINR(invoice.totalAmount)}</span>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-6 rounded-lg px-4 py-3 text-xs text-muted-foreground bg-secondary">
                <span className="font-medium text-foreground">{t('note')}: </span>{invoice.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
