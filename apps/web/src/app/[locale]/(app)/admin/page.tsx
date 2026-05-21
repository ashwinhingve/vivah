import { type ComponentType } from 'react';
import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
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
} from 'lucide-react';

import { PageHeader }     from '@/components/ui/PageHeader';
import { SectionHeader }  from '@/components/ui/SectionHeader';
import { StatCard }       from '@/components/ui/StatCard';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList }    from '@/components/motion/StaggerList.client';
import { KycQueueTable }  from '@/components/admin/KycQueueTable.client';
import { KycStatsBar }    from '@/components/admin/KycStatsBar';
import { AdminRefreshButton }   from './AdminRefreshButton.client';
import { AdminDisputesMini }    from './AdminDisputesMini.client';
import { AdminHealthAndRisk }   from './AdminHealthAndRisk.client';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthMe {
  id: string;
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

interface AtRiskUser {
  profileId:   string;
  userId:      string;
  riskBand:    string;
  score:       number | null;
  displayName: string | null;
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
    return (await res.json()) as ReadyResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Quick-nav grid config
// ---------------------------------------------------------------------------

interface NavTile {
  href:        string;
  label:       string;
  description: string;
  Icon:        ComponentType<{ className?: string }>;
}

const NAV_TILES: NavTile[] = [
  { href: '/admin/kyc',            label: 'KYC',            description: 'Identity verification queue',      Icon: ShieldCheck    },
  { href: '/admin/escrow',         label: 'Escrow',         description: 'Booking disputes & releases',      Icon: Scale          },
  { href: '/admin/payouts',        label: 'Payouts',        description: 'Vendor payout management',         Icon: ReceiptText    },
  { href: '/admin/promos',         label: 'Promos',         description: 'Promo codes & discounts',          Icon: BadgePercent   },
  { href: '/admin/reconciliation', label: 'Reconciliation', description: 'Payment ledger reconciliation',    Icon: ArrowLeftRight },
  { href: '/admin/refunds',        label: 'Refunds',        description: 'Customer refund processing',       Icon: Undo2          },
  { href: '/admin/revenue',        label: 'Revenue',        description: 'Platform revenue analytics',       Icon: TrendingUp     },
  { href: '/admin/analytics',      label: 'Analytics',      description: 'Platform growth & engagement trends', Icon: BarChart3    },
  // Vendor approval — no endpoint yet; link retained as it will have a page
  // TODO: no vendor-approval queue endpoint — add when Phase 3 vendor-mgmt ships
  { href: '#',                     label: 'Vendors',        description: 'Vendor approval queue — coming soon', Icon: Store       },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminPage() {
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
  ] = await Promise.all([
    fetchAuth<{ profiles: KycRow[]; total: number }>('/api/v1/admin/kyc/pending', token),
    fetchAuth<KycStats>('/api/v1/admin/kyc/stats', token),
    fetchAuth<AdminStats>('/api/v1/admin/stats', token),
    fetchAuth<{ disputes: BookingDispute[] }>('/api/v1/admin/disputes', token),
    fetchAuth<{ items: AtRiskUser[]; total: number; cached: boolean }>(
      '/api/v1/admin/users/at-risk?limit=5', token
    ),
    fetchReady(),
    fetchAuth<{ items: VendorQueueRow[]; total: number }>(
      '/api/v1/admin/vendors/queue?status=PENDING&limit=5', token
    ),
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
  const disputes          = disputesData?.disputes   ?? [];
  const atRiskItems       = atRiskData?.items        ?? [];
  const atRiskTotal       = atRiskData?.total        ?? 0;
  const vendorQueue       = vendorQueueData?.items   ?? [];
  const vendorQueueTotal  = vendorQueueData?.total   ?? 0;

  // Health strip — map /ready.checks to labelled ServiceCheck array
  const serviceChecks = readyData
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
        <PageHeader
          title="Admin Console"
          subtitle={`Smart Shaadi platform overview — refreshed ${refreshedAt} IST`}
          actions={<AdminRefreshButton />}
        />

        {/* ── System health ── */}
        <section>
          <SectionHeader title="System Health" subtitle="Infrastructure status from /ready" />
          <AdminHealthAndRisk
            serviceChecks={serviceChecks}
            aiModels={aiModels}
            atRiskItems={atRiskItems}
            atRiskTotal={atRiskTotal}
          />
        </section>

        {/* ── Headline metrics ── */}
        <section>
          <SectionHeader title="Platform Metrics" />
          <StaggerList className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Users"        value={totalUsers} />
            <StatCard label="Active Vendors"     value={activeVendors} />
            <StatCard label="Bookings This Month" value={bookingsThisMonth} />
            {/* Active disputes — from real /admin/disputes */}
            <div
              className={`rounded-2xl border bg-surface p-6 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover ${
                disputes.length > 0
                  ? 'border-destructive/30'
                  : 'border-gold/20'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Open Disputes
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className={`font-heading text-[32px] font-semibold leading-none ${disputes.length > 0 ? 'text-destructive' : 'text-success'}`}>
                  {disputes.length}
                </span>
                {disputes.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    Action needed
                  </span>
                )}
              </div>
            </div>
          </StaggerList>
        </section>

        {/* ── Action queues ── */}
        <section>
          <SectionHeader title="Action Queues" subtitle="Items requiring moderation" />
          <div className="grid gap-5 lg:grid-cols-3">

            {/* KYC queue */}
            <div className="flex flex-col rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="border-b border-gold/10 px-5 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    KYC Review
                  </h3>
                  {kycQueue.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                      {kycQueue.length} pending
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
                  Open full KYC console →
                </Link>
              </div>
            </div>

            {/* Disputes queue */}
            <div className="flex flex-col rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="border-b border-gold/10 px-5 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    Open Disputes
                  </h3>
                  {disputes.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      {disputes.length} open
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <AdminDisputesMini disputes={disputes.slice(0, 5)} />
              </div>
            </div>

            {/* Vendor approval queue (P1-8 — wired) */}
            <div className="flex flex-col rounded-2xl border border-gold/20 bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-gold/10 px-5 pt-5 pb-4">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-gold" aria-hidden="true" />
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    Vendor Approvals
                  </h3>
                </div>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                  {vendorQueueTotal}
                </span>
              </div>
              {vendorQueue.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <p className="font-heading text-sm font-semibold text-primary">All caught up</p>
                  <p className="max-w-[200px] text-xs text-text-muted">
                    No pending vendor applications.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gold/10">
                  {vendorQueue.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/admin/vendors/${v.id}`}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-background"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {v.businessName}
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
                Open full queue →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Analytics ── */}
        <section>
          <SectionHeader title="Analytics" subtitle="Platform growth, engagement & revenue" />
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
                  Open Analytics Dashboard
                </p>
                <p className="text-sm text-text-muted">
                  Signups, match activity, engagement risk, revenue &amp; top matches
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-teal transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </section>

        {/* ── Activity log placeholder ── */}
        <section>
          <SectionHeader title="Recent Activity" />
          {/* TODO: no audit / activity-log endpoint — add GET /api/v1/admin/audit
              when the activity-log service ships in a later phase. */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gold/30 bg-surface px-6 py-10 text-center">
            <Activity className="h-8 w-8 text-gold-muted" strokeWidth={1.25} aria-hidden />
            <p className="font-heading text-sm font-semibold text-primary">Activity log</p>
            <p className="text-xs text-text-muted">
              Admin event stream coming in a later phase — no endpoint available yet.
            </p>
          </div>
        </section>

        {/* ── Quick navigation grid ── */}
        <section>
          <SectionHeader title="Quick Navigation" subtitle="Jump to any admin module" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NAV_TILES.map(({ href, label, description, Icon }) => {
              const isComingSoon = href === '#';
              return (
                <Link
                  key={label}
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
                          soon
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
