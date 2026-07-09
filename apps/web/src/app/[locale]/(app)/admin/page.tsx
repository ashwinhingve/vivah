import { type ComponentType } from 'react';
import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/redirect';
import {
  ShieldCheck,
  Scale,
  Store,
  ReceiptText,
  BadgePercent,
  ArrowLeftRight,
  Undo2,
  TrendingUp,
  BarChart3,
  Activity,
  ArrowRight,
  Users,
  CalendarCheck,
} from 'lucide-react';

import { SectionHeader }  from '@/components/ui/SectionHeader';
import { StatsCard }      from '@/components/dashboard/StatsCard';
import { RoleHero }       from '@/components/shared/RoleHero';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList }    from '@/components/shared/StaggerList.client';
import { KycQueueTable }  from '@/components/admin/KycQueueTable.client';
import { KycStatsBar }    from '@/components/admin/KycStatsBar';
import { AdminSectionBoundary } from '@/components/admin/AdminSectionBoundary.client';
import { AdminRefreshButton }   from './AdminRefreshButton.client';
import { AdminDisputesMini }    from './AdminDisputesMini.client';
import { AdminHealthAndRisk }   from './AdminHealthAndRisk.client';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

interface AdminStats {
  totalUsers:        number;
  activeVendors:     number;
  bookingsThisMonth: number;
}

interface KycRow {
  profileId:          string;
  userId:             string;
  verificationStatus: string;
  verificationLevel:  string | null;
  aadhaarVerified:    boolean | null;
  panVerified:        boolean | null;
  bankVerified:       boolean | null;
  livenessScore:      number | null;
  faceMatchScore:     number | null;
  riskScore:          number | null;
  duplicateFlag:      boolean | null;
  duplicateReason:    string | null;
  sanctionsHit:       boolean | null;
  attemptCount:       number | null;
  submittedAt:        string | null;
}

interface KycStats {
  pending:        number;
  verified:       number;
  rejected:       number;
  infoRequested:  number;
  pendingAppeals: number;
  duplicates:     number;
  sanctions:      number;
}

// Shape actually returned by GET /api/v1/admin/disputes (booking-level rows —
// there is no dispute-level `id`, `reason`, or `raisedByType`; `raisedAt` is the
// booking-created time). See apps/api/src/payments/dispute.ts:getDisputedBookings.
interface RawDispute {
  bookingId:    string;
  customerName: string | null;
  totalAmount:  string | null;
  escrowHeld:   string | null;
  escrowStatus: string;
  raisedAt:     string | null;
}

// Normalized shape consumed by <AdminDisputesMini> / the Open Disputes card.
interface BookingDispute {
  id:          string;
  bookingId:   string;
  raisedBy:    string;
  raisedByType: string;
  reason:      string;
  status:      string;
  amount:      number | null;
  raisedAt:    string;
}

// Shape actually returned by GET /api/v1/admin/users/at-risk — the endpoint
// returns Stay-Quotient scoring rows (see apps/api/src/services/stayService.ts
// :StayQuotientResponse). There is NO profileId/displayName; keys are snake_case
// and risk_band is lowercase ('low'|'medium'|'high'|'critical'). Passing these
// raw into the UI is what caused the recurring undefined.slice() 500.
interface RawAtRiskUser {
  user_id:            string;
  churn_probability:  number;
  risk_band:          string;
}

// Normalized shape consumed by <AdminHealthAndRisk>.
interface AtRiskUser {
  userId:      string;
  riskBand:    string;       // upper-cased for badge/colour matching
  score:       number | null; // churn_probability
  displayName: string | null; // never available from this endpoint
}

// P1-8: minimal shape for the vendor-approval mini queue on the admin dashboard.
interface VendorQueueRow {
  id:                string;
  businessName:      string;
  category:          string;
  city:              string;
  status:            string;
  submittedAt:       string | null;
  rejectionReason:   string | null;
  rejectionCategory: string | null;
}

// Recent-activity mini-feed — shape returned by GET /api/v1/admin/audit
// (apps/api/src/admin/audit.router.ts), trimmed to what the dashboard widget
// renders.
interface RecentAuditRow {
  id:         string;
  eventType:  string;
  entityType: string;
  actorName:  string | null;
  createdAt:  string;
}

// Infra health types from /ready
interface ReadyChecks {
  postgres: string;
  redis:    string;
  mongo:    string;
}

interface ReadyResponse {
  status: string;
  checks: ReadyChecks;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Fetch the infra readiness endpoint (no auth required). */
async function fetchReady(): Promise<ReadyResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/ready`, { cache: 'no-store' });
    if (!res.ok) return null;
    // /ready returns the standard { success, data: { status, checks } } envelope
    // (apps/api/src/index.ts). Unwrap `.data` — mirroring fetchAuth. Returning the
    // raw envelope left `readyData.checks` undefined, so `readyData.checks.postgres`
    // 500'd the whole console whenever /ready was healthy (i.e. in production).
    const json = (await res.json()) as { success: boolean; data: ReadyResponse };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Short relative time for the recent-activity feed, e.g. "5m ago" / "3d ago". */
function relativeAuditTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Quick-nav grid config
// ---------------------------------------------------------------------------

interface NavTileDef {
  href: string;
  key:  'kyc' | 'escrow' | 'payouts' | 'promos' | 'reconciliation' | 'refunds' | 'revenue' | 'analytics' | 'vendors';
  Icon: ComponentType<{ className?: string }>;
}

// Labels/descriptions are translated via adminRole.navTiles.<key> at render time.
const NAV_TILES: NavTileDef[] = [
  { href: '/admin/kyc',            key: 'kyc',            Icon: ShieldCheck    },
  { href: '/admin/escrow',         key: 'escrow',         Icon: Scale          },
  { href: '/admin/payouts',        key: 'payouts',        Icon: ReceiptText    },
  { href: '/admin/promos',         key: 'promos',         Icon: BadgePercent   },
  { href: '/admin/reconciliation', key: 'reconciliation', Icon: ArrowLeftRight },
  { href: '/admin/refunds',        key: 'refunds',        Icon: Undo2          },
  { href: '/admin/revenue',        key: 'revenue',        Icon: TrendingUp     },
  { href: '/admin/analytics',      key: 'analytics',      Icon: BarChart3      },
  { href: '/admin/vendors',        key: 'vendors',        Icon: Store          },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminPage() {
  const t = await getTranslations('adminRole');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  // Role guard — keep exactly as original.
  // middleware already verified ADMIN; redirect only if /api/auth/me positively
  // identifies a non-admin role (prevents a loop when the API is unreachable).
  const me = await fetchAuth<AuthMe>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  // Parallel data fetches — tolerate null (show "—" / empty states gracefully)
  const [
    kycData,
    kycStatsRaw,
    stats,
    disputesData,
    atRiskData,
    readyData,
    vendorQueueData,
    auditData,
  ] = await Promise.all([
    fetchAuth<{ profiles: KycRow[]; total: number }>('/api/v1/admin/kyc/pending', token),
    fetchAuth<KycStats>('/api/v1/admin/kyc/stats', token),
    fetchAuth<AdminStats>('/api/v1/admin/stats', token),
    fetchAuth<{ disputes: RawDispute[] }>('/api/v1/admin/disputes', token),
    fetchAuth<{ items: RawAtRiskUser[]; total: number; cached: boolean }>(
      '/api/v1/admin/users/at-risk?limit=5', token
    ),
    fetchReady(),
    fetchAuth<{ items: VendorQueueRow[]; total: number }>(
      '/api/v1/admin/vendors/queue?status=PENDING&limit=5', token
    ),
    fetchAuth<{ items: RecentAuditRow[]; total: number }>('/api/v1/admin/audit?limit=6', token),
  ]);

  // Derive values with safe defaults
  const kycQueue     = kycData?.profiles ?? [];
  const kycStats     = kycStatsRaw ?? {
    pending: 0, verified: 0, rejected: 0,
    infoRequested: 0, pendingAppeals: 0, duplicates: 0, sanctions: 0,
  };
  const totalUsers        = stats?.totalUsers        ?? 0;
  const activeVendors     = stats?.activeVendors     ?? 0;
  const bookingsThisMonth = stats?.bookingsThisMonth ?? 0;
  // Normalize the API's booking-level rows into the dispute shape the UI expects.
  // The endpoint has no dispute-level id/reason/raisedByType — derive safe values.
  const disputes: BookingDispute[] = (disputesData?.disputes ?? []).map((d) => ({
    id:           d.bookingId,
    bookingId:    d.bookingId,
    raisedByType: 'CUSTOMER',
    raisedBy:     d.customerName ?? '',
    reason:       'Escrow dispute',
    status:       d.escrowStatus,
    amount:       Number(d.totalAmount ?? d.escrowHeld ?? 0) || null,
    raisedAt:     d.raisedAt ?? '',
  }));
  // Normalize the API's Stay-Quotient rows into the shape the UI expects.
  // The endpoint has no profileId/displayName; risk_band is lowercase — map
  // explicitly (mirrors the RawDispute → BookingDispute normalization above).
  const atRiskItems: AtRiskUser[] = (atRiskData?.items ?? []).map((u) => ({
    userId:      u.user_id,
    riskBand:    (u.risk_band ?? '').toUpperCase(),
    score:       u.churn_probability,
    displayName: null,
  }));
  const atRiskTotal       = atRiskData?.total        ?? 0;
  const vendorQueue       = vendorQueueData?.items   ?? [];
  const vendorQueueTotal  = vendorQueueData?.total   ?? 0;
  const recentActivity: RecentAuditRow[] = auditData?.items ?? [];

  // Health strip — map /ready.checks to labelled ServiceCheck array.
  // Guard on `readyData?.checks` (not just readyData) so a future envelope-shape
  // drift can never re-introduce the `undefined.postgres` render crash.
  const serviceChecks = readyData?.checks
    ? [
        { label: 'PostgreSQL', ok: readyData.checks.postgres === 'ok' },
        { label: 'Redis',      ok: readyData.checks.redis     === 'ok' },
        { label: 'MongoDB',    ok: readyData.checks.mongo     === 'ok' },
      ]
    : [
        { label: 'PostgreSQL', ok: false },
        { label: 'Redis',      ok: false },
        { label: 'MongoDB',    ok: false },
      ];

  // AI models: cannot reach AI-service from web layer without a dedicated
  // NEXT_PUBLIC_AI_SERVICE_URL env var that does not exist yet.
  // Pass null so the client component omits the row gracefully.
  // TODO: expose AI_SERVICE_URL to web app and fetch ${AI_SERVICE_URL}/health here.
  const aiModels = null;

  // Last-refresh time (server render time = IST)
  const refreshedAt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-5xl px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <RoleHero
          title={t('title')}
          subtitle={t('subtitle')}
          rightSlot={
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{t('refreshedAt', { time: refreshedAt })}</span>
              <AdminRefreshButton />
            </div>
          }
        />

        {/* ── System health ── */}
        <section>
          <SectionHeader title={t('systemHealth.title')} subtitle={t('systemHealth.subtitle')} />
          <AdminSectionBoundary section="System Health" key={refreshedAt}>
            <AdminHealthAndRisk
              serviceChecks={serviceChecks}
              aiModels={aiModels}
              atRiskItems={atRiskItems}
              atRiskTotal={atRiskTotal}
            />
          </AdminSectionBoundary>
        </section>

        {/* ── Headline metrics ── */}
        <section>
          <SectionHeader title={t('platformMetrics.title')} />
          <AdminSectionBoundary section="Platform Metrics" key={refreshedAt}>
          <StaggerList className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatsCard label={t('platformMetrics.totalUsers')}         value={totalUsers}        icon={Users}         variant="teal"    href="/admin/users"    animDelayMs={0} />
            <StatsCard label={t('platformMetrics.activeVendors')}      value={activeVendors}     icon={Store}         variant="gold"    href="/admin/vendors"  animDelayMs={80} />
            <StatsCard label={t('platformMetrics.bookingsThisMonth')}  value={bookingsThisMonth} icon={CalendarCheck} variant="success" animDelayMs={160} />
            <StatsCard
              label={t('platformMetrics.openDisputes')}
              value={disputes.length}
              icon={Scale}
              variant={disputes.length > 0 ? 'warning' : 'default'}
              href="/admin/escrow"
              sub={disputes.length > 0 ? t('platformMetrics.actionNeeded') : t('platformMetrics.allClear')}
              animDelayMs={240}
            />
          </StaggerList>
          </AdminSectionBoundary>
        </section>

        {/* ── Action queues ── */}
        <section>
          <SectionHeader title={t('actionQueues.title')} subtitle={t('actionQueues.subtitle')} />
          <div className="grid gap-5 lg:grid-cols-3">

            {/* KYC queue */}
            <AdminSectionBoundary section="KYC Review" key={refreshedAt}>
            <div className="flex flex-col rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="border-b border-gold/10 px-5 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    {t('kyc.title')}
                  </h3>
                  {kycQueue.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                      {t('kyc.pendingBadge', { count: kycQueue.length })}
                    </span>
                  )}
                </div>
              </div>

              {/* KYC stats bar */}
              <div className="px-5 pt-4">
                <KycStatsBar stats={kycStats} />
              </div>

              {/* KYC table (top rows) */}
              <div className="flex-1 overflow-hidden px-5 pt-4">
                <KycQueueTable initialRows={kycQueue.slice(0, 5)} />
              </div>

              {/* Footer link */}
              <div className="border-t border-gold/10 px-5 py-3">
                <Link
                  href="/admin/kyc"
                  className="text-xs font-semibold text-teal transition-colors hover:text-teal-hover"
                >
                  {t('kyc.openConsole')}
                </Link>
              </div>
            </div>
            </AdminSectionBoundary>

            {/* Disputes queue */}
            <AdminSectionBoundary section="Open Disputes" key={refreshedAt}>
            <div className="flex flex-col rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="border-b border-gold/10 px-5 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    {t('platformMetrics.openDisputes')}
                  </h3>
                  {disputes.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      {t('disputes.openBadge', { count: disputes.length })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <AdminDisputesMini disputes={disputes.slice(0, 5)} />
              </div>
            </div>
            </AdminSectionBoundary>

            {/* Vendor approval queue (P1-8 — wired) */}
            <AdminSectionBoundary section="Vendor Approvals" key={refreshedAt}>
            <div className="flex flex-col rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-gold/10 px-5 pt-5 pb-4">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-gold" aria-hidden="true" />
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    {t('vendorApprovals.title')}
                  </h3>
                </div>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                  {vendorQueueTotal}
                </span>
              </div>
              {vendorQueue.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <p className="font-heading text-sm font-semibold text-primary">{t('vendorApprovals.allCaughtUp')}</p>
                  <p className="max-w-[200px] text-xs text-text-muted">
                    {t('vendorApprovals.noPending')}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gold/10">
                  {vendorQueue.map((v) => (
                    <li key={v.id ?? v.businessName}>
                      <Link
                        href={`/admin/vendors/${v.id}`}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-background"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {v.businessName ?? t('vendorApprovals.unnamedVendor')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {v.category} · {v.city}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/admin/vendors"
                className="border-t border-gold/10 px-5 py-3 text-center text-xs font-semibold text-teal transition-colors hover:bg-background"
              >
                {t('vendorApprovals.openQueue')}
              </Link>
            </div>
            </AdminSectionBoundary>
          </div>
        </section>

        {/* ── Analytics ── */}
        <section>
          <SectionHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />
          <AdminSectionBoundary section="Analytics" key={refreshedAt}>
          <Link
            href="/admin/analytics"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-gold/20 bg-surface p-6 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 text-teal">
                <BarChart3 className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </span>
              <div>
                <p className="font-heading text-base font-semibold text-primary">
                  {t('analytics.openDashboard')}
                </p>
                <p className="text-sm text-text-muted">
                  {t('analytics.description')}
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-teal transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
          </AdminSectionBoundary>
        </section>

        {/* ── Recent Activity ── */}
        <section>
          <SectionHeader title={t('recentActivity.title')} viewAllHref="/admin/audit" viewAllLabel={t('common.viewAll')} />
          <AdminSectionBoundary section="Recent Activity" key={refreshedAt}>
            <div className="overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Activity className="h-8 w-8 text-gold-muted" strokeWidth={1.5} aria-hidden />
                  <p className="text-sm font-semibold text-primary">{t('recentActivity.emptyTitle')}</p>
                  <p className="text-xs text-text-muted">{t('recentActivity.emptyDescription')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gold/10">
                  {recentActivity.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={1.5} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">
                            {ev.eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-text-muted">· {ev.entityType}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                          {ev.actorName ?? t('common.system')} · {relativeAuditTime(ev.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminSectionBoundary>
        </section>

        {/* ── Quick navigation grid ── */}
        <section>
          <SectionHeader title={t('quickNav.title')} subtitle={t('quickNav.subtitle')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NAV_TILES.map(({ href, key, Icon }) => {
              const isComingSoon = href === '#';
              const label = t(`navTiles.${key}.label`);
              const description = t(`navTiles.${key}.description`);
              return (
                <Link
                  key={key}
                  href={href}
                  aria-disabled={isComingSoon}
                  tabIndex={isComingSoon ? -1 : undefined}
                  className={`group flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isComingSoon
                      ? 'pointer-events-none border-dashed border-gold/20 opacity-60'
                      : 'border-gold/20 hover:border-gold/40'
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading text-sm font-semibold text-text-primary">
                      {label}
                      {isComingSoon && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-gold/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold-muted">
                          {t('quickNav.soon')}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                      {description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Footer padding */}
        <div className="h-8" />
      </PageTransition>
    </main>
  );
}
