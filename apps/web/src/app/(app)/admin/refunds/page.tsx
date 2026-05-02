/**
 * Smart Shaadi — Admin Refund Queue
 * Hybrid: Server Component fetches + client component handles decisions.
 */
import { cookies } from 'next/headers';
import type { RefundRecord } from '@smartshaadi/types';
import { AdminRefundsClient } from './AdminRefundsClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchRefunds(cookie: string, status: string): Promise<RefundRecord[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/refunds/admin/list?status=${status}&limit=50`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API envelope: { success, data: { items: [...] } }
    const json = (await res.json()) as {
      success: boolean;
      data: { items: RefundRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const status = sp['status'] ?? 'REQUESTED';

  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    return (
      <div className="min-h-screen px-4 py-16 text-center" style={{ background: '#FEFAF6' }}>
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const cookie  = `better-auth.session_token=${token}`;
  const refunds = await fetchRefunds(cookie, status);

  return <AdminRefundsClient initialRefunds={refunds} initialStatus={status} />;
}
