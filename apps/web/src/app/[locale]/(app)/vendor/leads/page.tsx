/**
 * Vendor leads inbox — Tier 3 Track 2 (pay-per-qualified-lead).
 *
 * Server component. Resolves the vendor via /api/v1/vendors/me, then
 * fetches the leads inbox + aggregate stats in parallel. Read-only —
 * admin qualification/refund actions live on a separate admin page.
 */
import { cookies } from 'next/headers';
import { Users, TrendingUp, Wallet, Receipt, ListFilter } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { RoleHero } from '@/components/shared/RoleHero';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
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
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const cookie = await authCookie();
  if (!cookie) return await redirect('/login');

  const vendor = await fetchVendorMe(cookie);
  const params = await searchParams;
  const status = statusFromQuery(params.status);

  return (
    <PageTransition>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <RoleHero
          title="Customer leads"
          subtitle="Inquiries sent directly to your vendor profile. You are charged per qualified lead."
          icon={Users}
        />

        <div className="mt-6">
          {!vendor ? (
            <FadeUp>
              <EmptyState
                icon={Users}
                title="Vendor account required"
                description="You need a vendor account to view this page."
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

function LeadStats({ stats }: { stats: VendorLeadStats | null }) {
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
        <StatsCard label="Total leads" value={stats.totalLeads} icon={Users} variant="default" animDelayMs={0} />
        <StatsCard label="Qualified" value={pct} valuePercent={pct} icon={TrendingUp} variant="teal" animDelayMs={80} />
        <StatsCard label="Charges (mo.)" value={`₹${stats.monthChargedInr}`} icon={Wallet} variant="gold" animDelayMs={160} />
        <StatsCard label="Avg fee" value={`₹${stats.avgFeeInr}`} icon={Receipt} variant="default" animDelayMs={240} />
      </section>
    </FadeUp>
  );
}

function StatusFilters({ active }: { active?: LeadFeeStatus }) {
  const opts: Array<{ label: string; value?: LeadFeeStatus }> = [
    { label: 'All' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Charged', value: 'CHARGED' },
    { label: 'Refunded', value: 'REFUNDED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs">
      <ListFilter className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
      {opts.map(o => {
        const isActive = (o.value ?? undefined) === active;
        const href = o.value ? `/vendor/leads?status=${o.value}` : '/vendor/leads';
        return (
          <Link
            key={o.label}
            href={href}
            className={cn(
              'rounded-full border px-3 py-1.5 transition-colors',
              isActive
                ? 'border-primary bg-primary text-white'
                : 'border-gold/30 text-muted-foreground hover:border-primary/40',
            )}
          >
            {o.label}
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

function LeadRow({ lead }: { lead: VendorLeadRow }) {
  const date = lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN') : '—';
  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-heading text-primary truncate">
            {lead.inquirerName ?? 'Anonymous'}
          </div>
          <div className="text-xs text-muted-foreground">
            {lead.eventType} · {date} {lead.eventLocation ? `· ${lead.eventLocation}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={lead.feeStatus} />
          <span className="text-xs text-muted-foreground">₹{lead.feeChargedInr}</span>
        </div>
      </div>
      {lead.message ? (
        <p className="mt-2 text-sm text-text/90 line-clamp-3">{lead.message}</p>
      ) : null}
      {lead.feeStatus === 'REFUNDED' && lead.refundReason ? (
        <p className="mt-2 text-xs text-warning">Refunded — {lead.refundReason}</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: LeadFeeStatus }) {
  const styles: Record<LeadFeeStatus, string> = {
    PENDING:         'bg-warning/10 text-warning border-warning/30',
    QUALIFIED:       'bg-teal/10 text-teal border-teal/30',
    CHARGED:         'bg-success/10 text-success border-success/30',
    REFUNDED:        'bg-destructive/10 text-destructive border-destructive/30',
    CANCELLED:       'bg-muted text-muted-foreground border-border',
    PENDING_PAYMENT: 'bg-warning/20 text-warning border-warning/40',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
