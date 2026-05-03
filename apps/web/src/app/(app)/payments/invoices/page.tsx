/**
 * Smart Shaadi — Invoice List Page
 * Server Component
 */
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { InvoiceRecord, InvoiceStatus } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchInvoices(): Promise<InvoiceRecord[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/invoices?limit=50`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API envelope: { success, data: { items: [...] } }
    const json = (await res.json()) as {
      success: boolean;
      data: { items: InvoiceRecord[] } | null;
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
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_MAP: Record<InvoiceStatus, { bg: string; text: string; label: string }> = {
  DRAFT:     { bg: 'bg-secondary',  text: 'text-muted-foreground',  label: 'Draft' },
  ISSUED:    { bg: 'bg-teal/10',   text: 'text-teal',   label: 'Issued' },
  PAID:      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Paid' },
  CANCELLED: { bg: 'bg-destructive/15',    text: 'text-destructive',    label: 'Cancelled' },
  CREDITED:  { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Credited' },
};

export default async function InvoicesPage() {
  const invoices = await fetchInvoices();

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GST-compliant invoices for your bookings and orders
          </p>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center border-gold">
            <p className="font-medium text-primary">No invoices yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invoices are generated when a booking or order is confirmed.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden shadow-sm border-gold">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Invoice No.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-gold/15">
                  {invoices.map(inv => {
                    const badge = STATUS_MAP[inv.status] ?? { bg: 'bg-secondary', text: 'text-muted-foreground', label: inv.status };
                    return (
                      <tr key={inv.id} className="bg-surface hover:bg-gold/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-foreground font-medium">
                          {inv.invoiceNo}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(inv.issuedAt)}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground max-w-[120px] truncate">
                          {inv.vendorName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">
                          {formatINR(inv.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/payments/invoices/${inv.id}`}
                            className="text-xs font-medium hover:underline text-teal"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
