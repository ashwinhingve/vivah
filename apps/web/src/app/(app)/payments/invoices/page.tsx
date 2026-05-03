/**
 * Smart Shaadi — Invoice List Page
 * Server Component
 */
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { InvoiceRecord, InvoiceStatus } from '@smartshaadi/types';
import {
  Container,
  DataTable,
  type DataTableColumn,
  PageHeader,
} from '@/components/shared';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchInvoices(): Promise<InvoiceRecord[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/invoices?limit=50`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_MAP: Record<InvoiceStatus, { className: string; label: string }> = {
  DRAFT: { className: 'bg-secondary text-muted-foreground', label: 'Draft' },
  ISSUED: { className: 'bg-teal/10 text-teal', label: 'Issued' },
  PAID: { className: 'bg-success/15 text-success', label: 'Paid' },
  CANCELLED: { className: 'bg-destructive/15 text-destructive', label: 'Cancelled' },
  CREDITED: { className: 'bg-primary/15 text-primary', label: 'Credited' },
};

export default async function InvoicesPage() {
  const invoices = await fetchInvoices();

  const columns: DataTableColumn<InvoiceRecord>[] = [
    {
      key: 'invoiceNo',
      header: 'Invoice No.',
      render: (i) => (
        <span className="font-mono text-xs font-medium text-foreground">{i.invoiceNo}</span>
      ),
    },
    {
      key: 'issuedAt',
      header: 'Date',
      render: (i) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(i.issuedAt)}
        </span>
      ),
    },
    {
      key: 'vendorName',
      header: 'Vendor',
      render: (i) => (
        <span className="block max-w-[120px] truncate text-xs text-foreground">
          {i.vendorName ?? '—'}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (i) => (
        <span className="whitespace-nowrap text-xs font-semibold text-foreground">
          {formatINR(i.totalAmount)}
        </span>
      ),
      cellClassName: 'text-right',
      headClassName: 'text-right',
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => {
        const badge =
          STATUS_MAP[i.status] ?? {
            className: 'bg-secondary text-muted-foreground',
            label: i.status,
          };
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (i) => (
        <Link
          href={`/payments/invoices/${i.id}`}
          className="text-xs font-medium text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="narrow">
        <PageHeader
          title="Invoices"
          subtitle="GST-compliant invoices for your bookings and orders"
        />
        <DataTable
          columns={columns}
          data={invoices}
          rowKey={(i) => i.id}
          empty={{
            title: 'No invoices yet',
            description: 'Invoices are generated when a booking or order is confirmed.',
          }}
        />
      </Container>
    </main>
  );
}
