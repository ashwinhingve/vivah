/**
 * Smart Shaadi — Admin Payouts Page
 * Hybrid: Server Component fetches + client component handles actions.
 */
import { cookies } from 'next/headers';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';
import { AdminPayoutsClient } from './AdminPayoutsClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchPayouts(cookie: string, status?: string): Promise<PayoutRecord[]> {
  try {
    const qs = status ? `?status=${status}&limit=50` : '?limit=50';
    const res = await fetch(`${API_URL}/api/v1/payments/payouts/admin/list${qs}`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API envelope: { success, data: { items: [...] }, error, meta }
    const json = (await res.json()) as {
      success: boolean;
      data: { items: PayoutRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    return (
      <div className="min-h-screen px-4 py-16 text-center" style={{ background: '#FEFAF6' }}>
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }
  const cookie = `better-auth.session_token=${token}`;
  const payouts = await fetchPayouts(cookie, sp['status']);

  return <AdminPayoutsClient initialPayouts={payouts} initialStatus={(sp['status'] as PayoutStatus | undefined) ?? 'ALL'} />;
}
