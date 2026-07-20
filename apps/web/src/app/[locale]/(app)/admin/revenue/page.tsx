/**
 * Smart Shaadi — Admin Revenue Dashboard
 * Server Component with client date filter.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import type { RevenueSummary, RevenueByCategory, DailyRevenuePoint } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { AdminRevenueClient } from './AdminRevenueClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe { userId: string; role: string; status: string }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRole' });
  return { title: `${t('navTiles.revenue.label')} — Admin | Smart Shaadi` };
}

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
  const t = await getTranslations('adminRole');
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
  // Defense-in-depth: middleware fail-opens if /api/auth/me errors, so re-check
  // the role here and redirect any non-admin off the page.
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const [summary, daily, categories, topVendors, liabilities] = await Promise.all([
    fetchRevenueSummary(cookie, fromDate, toDate),
    fetchDaily(cookie, fromDate, toDate),
    fetchCategories(cookie, fromDate, toDate),
    fetchTopVendors(cookie, fromDate, toDate),
    fetchLiabilities(cookie),
  ]);

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.adminConsole')}
        </Link>

        <FadeUp>
          <PageHeader
            title={t('revenue.title')}
            subtitle={t('revenue.subtitle')}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('revenue.breadcrumb') }]}
          />
        </FadeUp>

        <FadeUp>
          <AdminRevenueClient
            summary={summary}
            daily={daily}
            categories={categories}
            topVendors={topVendors}
            liabilities={liabilities}
            fromDate={fromDate}
            toDate={toDate}
          />
        </FadeUp>
      </main>
    </PageTransition>
  );
}
