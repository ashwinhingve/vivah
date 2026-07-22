/**
 * Vendor leads inbox — Tier 3 Track 2 (pay-per-qualified-lead).
 *
 * Server component. Resolves the vendor via /api/v1/vendors/me, then
 * fetches the leads inbox + aggregate stats in parallel. Read-only —
 * admin qualification/refund actions live on a separate admin page.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations, getLocale } from 'next-intl/server';
import { Users, TrendingUp, Wallet, Receipt, ListFilter } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { cn } from '@/lib/utils';
import {
  fetchMyLeads,
  fetchMyLeadStats,
  type LeadFeeStatus,
  type VendorLeadRow,
  type VendorLeadStats,
} from '@/lib/vendor-leads-api';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('vendorRole.leads');
  return {
    title: t('title'),
  };
}

async function authCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchVendorMe(cookie: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/me`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: { id: string } | null };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

const VALID_STATUSES: readonly LeadFeeStatus[] = [
  'PENDING', 'CHARGED', 'REFUNDED', 'CANCELLED', 'PENDING_PAYMENT',
];

function statusFromQuery(raw: string | string[] | undefined): LeadFeeStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_STATUSES.find(s => s === raw);
}

export default async function VendorLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations('vendorRole.leads');
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const cookie = await authCookie();
  if (!cookie) return await redirect('/login');

  const vendor = await fetchVendorMe(cookie);
  const params = await searchParams;
  const status = statusFromQuery(params.status);

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6">
        <FadeUp>
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
          />
        </FadeUp>

        <div className="mt-6">
          {!vendor ? (
            <FadeUp>
              <EmptyState
                icon={Users}
                title={t('needVendorAccount')}
                description={t('needVendorAccountDesc')}
              />
            </FadeUp>
          ) : (
            <LeadsContent vendorId={vendor.id} status={status} />
          )}
        </div>
      </main>
    </PageTransition>
  );
}

async function LeadsContent({
  vendorId: _vendorId,
  status,
}: {
  vendorId: string;
  status?: LeadFeeStatus;
}) {
  const cookie = await authCookie();
  const filters: { status?: LeadFeeStatus; limit: number } = { limit: 50 };
  if (status) filters.status = status;
  const [leads, stats] = await Promise.all([
    fetchMyLeads(cookie ?? '', filters),
    fetchMyLeadStats(cookie ?? ''),
  ]);

  return (
    <div className="space-y-6">
      <LeadStats stats={stats} />
      <StatusFilters active={status} />
      <LeadList leads={leads} />
    </div>
  );
}

async function LeadStats({ stats }: { stats: VendorLeadStats | null }) {
  const t = await getTranslations('vendorRole.leads');

  if (!stats) {
    return (
      <div className="rounded-xl border border-gold/20 bg-surface p-4 text-sm text-muted-foreground">
        Stats unavailable.
      </div>
    );
  }
  const pct = Math.round(stats.qualifiedRate * 100);

  return (
    <FadeUp>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard label={t('statTotal')} value={stats.totalLeads} icon={Users} variant="default" animDelayMs={0} />
        <StatsCard label={t('statQualified')} value={pct} valuePercent={pct} icon={TrendingUp} variant="teal" animDelayMs={80} />
        <StatsCard label={t('statCharges')} value={`₹${stats.monthChargedInr}`} icon={Wallet} variant="gold" animDelayMs={160} />
        <StatsCard label={t('statAvgFee')} value={`₹${stats.avgFeeInr}`} icon={Receipt} variant="default" animDelayMs={240} />
      </section>
    </FadeUp>
  );
}

async function StatusFilters({ active }: { active?: LeadFeeStatus }) {
  const t = await getTranslations('vendorRole.leads');
  const opts: Array<{ labelKey: string; value?: LeadFeeStatus }> = [
    { labelKey: 'filterAll' },
    { labelKey: 'filterPending', value: 'PENDING' },
    { labelKey: 'filterCharged', value: 'CHARGED' },
    { labelKey: 'filterRefunded', value: 'REFUNDED' },
    { labelKey: 'filterCancelled', value: 'CANCELLED' },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs">
      <ListFilter className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
      {opts.map(o => {
        const isActive = (o.value ?? undefined) === active;
        const href = o.value ? `/vendor/leads?status=${o.value}` : '/vendor/leads';
        return (
          <Link
            key={o.labelKey}
            href={href}
            className={cn(
              'rounded-full border px-3 py-1.5 transition-colors',
              isActive
                ? 'border-primary bg-primary text-white'
                : 'border-gold/30 text-muted-foreground hover:border-primary/40',
            )}
          >
            {t(o.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

function LeadList({ leads }: { leads: VendorLeadRow[] }) {
  if (leads.length === 0) {
    return (
      <FadeUp>
        <EmptyState variant="no-leads" />
      </FadeUp>
    );
  }
  return (
    <StaggerList className="space-y-3">
      {leads.map(l => <LeadRow key={l.id} lead={l} />)}
    </StaggerList>
  );
}

async function LeadRow({ lead }: { lead: VendorLeadRow }) {
  const t = await getTranslations('vendorRole.leads');
  const tEventTypes = await getTranslations('vendorRole.onboarding.labels.eventTypes');
  const locale = await getLocale();
  const dateLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const date = lead.eventDate
    ? new Date(lead.eventDate).toLocaleDateString(dateLocale)
    : '—';

  const eventTypeLabels: Record<string, string> = {
    WEDDING:         tEventTypes('WEDDING'),
    HALDI:           tEventTypes('HALDI'),
    MEHNDI:          tEventTypes('MEHNDI'),
    SANGEET:         tEventTypes('SANGEET'),
    ENGAGEMENT:      tEventTypes('ENGAGEMENT'),
    RECEPTION:       tEventTypes('RECEPTION'),
    TILAK:           tEventTypes('TILAK'),
    SAGAN:           tEventTypes('SAGAN'),
    CORPORATE:       tEventTypes('CORPORATE'),
    FESTIVAL:        tEventTypes('FESTIVAL'),
    COMMUNITY:       tEventTypes('COMMUNITY'),
    COMMUNITY_EVENT: tEventTypes('COMMUNITY_EVENT'),
    GOVERNMENT:      tEventTypes('GOVERNMENT'),
    SCHOOL:          tEventTypes('SCHOOL'),
    OTHER:           tEventTypes('OTHER'),
  };

  const statusTones: Record<LeadFeeStatus, StatusTone> = {
    PENDING:         'warning',
    QUALIFIED:       'teal',
    CHARGED:         'success',
    REFUNDED:        'error',
    CANCELLED:       'neutral',
    PENDING_PAYMENT: 'warning',
  };

  const statusLabels: Record<LeadFeeStatus, string> = {
    PENDING:         t('statusPending'),
    QUALIFIED:       t('statusQualified'),
    CHARGED:         t('statusCharged'),
    REFUNDED:        t('statusRefunded'),
    CANCELLED:       t('statusCancelled'),
    PENDING_PAYMENT: t('statusPendingPayment'),
  };

  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-heading text-primary truncate">
            {lead.inquirerName ?? t('fallbackName')}
          </div>
          <div className="text-xs text-muted-foreground">
            {eventTypeLabels[lead.eventType] ?? lead.eventType} · {date} {lead.eventLocation ? `· ${lead.eventLocation}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip tone={statusTones[lead.feeStatus]}>
            {statusLabels[lead.feeStatus]}
          </StatusChip>
          <span className="text-xs text-muted-foreground">₹{lead.feeChargedInr}</span>
        </div>
      </div>
      {lead.message ? (
        <p className="mt-2 text-sm text-text/90 line-clamp-3">{lead.message}</p>
      ) : null}
      {lead.feeStatus === 'REFUNDED' && lead.refundReason ? (
        <p className="mt-2 text-xs text-warning">
          {t('refundedReason', { reason: lead.refundReason })}
        </p>
      ) : null}
    </div>
  );
}
