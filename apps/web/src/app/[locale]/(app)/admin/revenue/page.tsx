/**
 * Smart Shaadi — Admin Revenue Dashboard
 * Server Component with client date filter.
 */
import { cookies } from 'next/headers';
import type { RevenueSummary, RevenueByCategory, DailyRevenuePoint } from '@smartshaadi/types';
import { AdminRevenueClient } from './AdminRevenueClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Liability {
  label:  string;
  amount: number;
}

interface TopVendor {
  vendorId:   string;
  vendorName: string;
  revenue:    number;
  payouts:    number;
  count:      number;
}

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchRevenueSummary(cookie: string, fromDate: string, toDate: string): Promise<RevenueSummary | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/admin/analytics/summary?fromDate=${fromDate}&toDate=${toDate}`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: RevenueSummary | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function fetchDaily(cookie: string, fromDate: string, toDate: string): Promise<DailyRevenuePoint[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/admin/analytics/daily?fromDate=${fromDate}&toDate=${toDate}`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: DailyRevenuePoint[] | null };
    return json.data ?? [];
  } catch {
    return [];
  }
}

async function fetchCategories(cookie: string, fromDate: string, toDate: string): Promise<RevenueByCategory[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/admin/analytics/categories?fromDate=${fromDate}&toDate=${toDate}`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: RevenueByCategory[] | null };
    return json.data ?? [];
  } catch {
    return [];
  }
}

async function fetchTopVendors(cookie: string, fromDate: string, toDate: string): Promise<TopVendor[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/admin/analytics/top-vendors?fromDate=${fromDate}&toDate=${toDate}`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: TopVendor[] | null };
    return json.data ?? [];
  } catch {
    return [];
  }
}

async function fetchLiabilities(cookie: string): Promise<Liability[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/admin/analytics/liabilities`, {
      headers: { Cookie: cookie },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API returns: { data: { escrowHeld, pendingPayouts, walletLiability } }
    const json = (await res.json()) as {
      success: boolean;
      data: { escrowHeld: number; pendingPayouts: number; walletLiability: number } | null;
    };
    const d = json.data;
    if (!d) return [];
    return [
      { label: 'Escrow held',      amount: d.escrowHeld },
      { label: 'Pending payouts',  amount: d.pendingPayouts },
      { label: 'Wallet liability', amount: d.walletLiability },
    ];
  } catch {
    return [];
  }
}

function defaultDates(): { fromDate: string; toDate: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate:   to.toISOString().slice(0, 10),
  };
}

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const defaults = defaultDates();
  const fromDate = sp['from'] ?? defaults.fromDate;
  const toDate   = sp['to']   ?? defaults.toDate;

  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <div className="min-h-screen px-4 py-16 text-center bg-background">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const [summary, daily, categories, topVendors, liabilities] = await Promise.all([
    fetchRevenueSummary(cookie, fromDate, toDate),
    fetchDaily(cookie, fromDate, toDate),
    fetchCategories(cookie, fromDate, toDate),
    fetchTopVendors(cookie, fromDate, toDate),
    fetchLiabilities(cookie),
  ]);

  return (
    <AdminRevenueClient
      summary={summary}
      daily={daily}
      categories={categories}
      topVendors={topVendors}
      liabilities={liabilities}
      fromDate={fromDate}
      toDate={toDate}
    />
  );
}
