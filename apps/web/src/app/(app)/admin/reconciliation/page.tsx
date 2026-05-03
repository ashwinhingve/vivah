import { headers } from 'next/headers';
import { Container, PageHeader } from '@/components/shared';
import { ReconciliationTableClient } from './ReconciliationTableClient.client';

interface Discrepancy {
  id: string;
  paymentId: string | null;
  razorpayPaymentId: string | null;
  field: string;
  expected: string | null;
  actual: string | null;
  status: string;
  notes: string | null;
  detectedAt: string;
}

async function fetchDiscrepancies(): Promise<Discrepancy[]> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  try {
    const res = await fetch(`${apiBase}/api/v1/payments/admin/reconciliation`, {
      cache: 'no-store',
      headers: { cookie },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { items?: Discrepancy[] } };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  const items = await fetchDiscrepancies();
  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="wide">
        <PageHeader
          title="Settlement reconciliation"
          subtitle="Discrepancies between Razorpay settlement reports and local payment ledger"
        />
        <ReconciliationTableClient items={items} />
      </Container>
    </main>
  );
}
