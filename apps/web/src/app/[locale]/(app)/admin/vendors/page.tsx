/**
 * Admin Vendor Approval Queue (P1-8).
 * Server Component. Fetches /api/v1/admin/vendors/queue and renders a
 * filterable table. Status tabs map to vendor_status enum values.
 */
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft, Store } from 'lucide-react';
import { PageHeader }    from '@/components/ui/PageHeader';
import { EmptyState }    from '@/components/ui/EmptyState';
import { StaggerList }   from '@/components/motion/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';

export const dynamic = 'force-dynamic';

type VendorStatus = 'DRAFT' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface QueueRow {
  id:                string;
  businessName:      string;
  category:          string;
  city:              string;
  state:             string;
  status:            VendorStatus;
  submittedAt:       string | null;
  reviewedAt:        string | null;
  reviewedByUserId:  string | null;
  rejectionReason:   string | null;
  rejectionCategory: string | null;
}

const STATUS_TABS: { value: VendorStatus; label: string }[] = [
  { value: 'PENDING',      label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED',     label: 'Approved' },
  { value: 'REJECTED',     label: 'Rejected' },
  { value: 'SUSPENDED',    label: 'Suspended' },
];

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
  } catch { return null; }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number | null): string {
  if (days == null) return 'text-muted-foreground';
  if (days < 3)     return 'text-muted-foreground';
  if (days < 7)     return 'text-warning';
  return 'text-primary font-semibold';
}

export default async function AdminVendorsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  // Role guard mirrors apps/web/src/app/(app)/admin/page.tsx.
  const me = await fetchAuth<{ role: string }>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN') {
    redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const sp = await searchParams;
  const status = (STATUS_TABS.find((t) => t.value === sp.status)?.value ?? 'PENDING') as VendorStatus;

  const data = await fetchAuth<{ items: QueueRow[]; total: number }>(
    `/api/v1/admin/vendors/queue?status=${status}&limit=50`,
    token,
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Admin Console
        </Link>

        <PageHeader
          title="Vendor Approvals"
          subtitle={`${total} vendor${total === 1 ? '' : 's'} in this queue. Oldest first.`}
          breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Vendors' }]}
        />

        {/* Status tab strip */}
        <nav
          className="-mx-1 overflow-x-auto px-1"
          aria-label="Vendor status filter"
        >
          <div className="flex min-w-max gap-1.5 rounded-xl border border-gold/20 bg-surface p-1.5">
            {STATUS_TABS.map((t) => {
              const active = t.value === status;
              return (
                <Link
                  key={t.value}
                  href={`/admin/vendors?status=${t.value}`}
                  className={`relative shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-gold/10 hover:text-foreground'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Table */}
        {rows.length === 0 ? (
          <EmptyState
            variant="no-vendors"
            title={`No ${STATUS_TABS.find((t) => t.value === status)?.label.toLowerCase()} vendors`}
            description={status === 'PENDING'
              ? 'All caught up — newly submitted vendors will appear here.'
              : 'Switch tabs above to view other states.'}
          />
        ) : (
          <StaggerList className="grid grid-cols-1 gap-3">
            {rows.map((row) => {
              const days = daysSince(row.submittedAt);
              return (
                <Link
                  key={row.id}
                  href={`/admin/vendors/${row.id}`}
                  className="block rounded-2xl border border-gold/20 bg-surface px-5 py-4 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-card-hover"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-base font-semibold text-primary leading-tight truncate">
                        {row.businessName}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.category} · {row.city}{row.state ? `, ${row.state}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">
                        Submitted {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('en-IN') : '—'}
                      </p>
                      {days != null && (
                        <p className={urgencyClass(days)}>
                          {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} in queue`}
                        </p>
                      )}
                    </div>
                  </div>
                  {row.status === 'REJECTED' && row.rejectionReason && (
                    <p className="mt-2 text-xs text-destructive line-clamp-2">
                      <span className="font-semibold">Reason ({row.rejectionCategory}):</span> {row.rejectionReason}
                    </p>
                  )}
                </Link>
              );
            })}
          </StaggerList>
        )}

        {/* Mini legend */}
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Store className="h-3.5 w-3.5" aria-hidden="true" />
          Days-in-queue colour: under 3 days neutral · 3–7 amber · 7+ urgent.
        </p>
      </PageTransition>
    </main>
  );
}
