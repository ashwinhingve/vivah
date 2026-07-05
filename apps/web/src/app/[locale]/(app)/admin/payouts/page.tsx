/**
 * Smart Shaadi — Admin Payouts Page
 * Hybrid: Server Component fetches + client component handles actions.
 */
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';
import { AdminPayoutsClient } from './AdminPayoutsClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe { userId: string; role: string; status: string }

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
      <div className="min-h-screen px-4 py-16 text-center bg-background">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }
  // Defense-in-depth: middleware fail-opens if /api/auth/me errors, so re-check
  // the role here and redirect any non-admin off the page.
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const cookie = `better-auth.session_token=${token}`;
  const payouts = await fetchPayouts(cookie, sp['status']);

  return <AdminPayoutsClient initialPayouts={payouts} initialStatus={(sp['status'] as PayoutStatus | undefined) ?? 'ALL'} />;
}
