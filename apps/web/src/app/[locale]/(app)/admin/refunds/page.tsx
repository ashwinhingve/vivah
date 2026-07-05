/**
 * Smart Shaadi — Admin Refund Queue
 * Hybrid: Server Component fetches + client component handles decisions.
 */
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import type { RefundRecord } from '@smartshaadi/types';
import { AdminRefundsClient } from './AdminRefundsClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe { userId: string; role: string; status: string }

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

  const cookie  = `better-auth.session_token=${token}`;
  const refunds = await fetchRefunds(cookie, status);

  return <AdminRefundsClient initialRefunds={refunds} initialStatus={status} />;
}
