import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { LifeBuoy, AlertTriangle, Clock, CheckCircle2, Flag, Scale, ShieldAlert } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PriorityPill, StatusPill, SlaBadge } from '@/components/support/badges';
import {
  fetchSupportQueue,
  fetchSupportStats,
  type TicketListItem,
  type TicketStatus,
} from '@/lib/support-api';

export const metadata = { title: 'Support Console' };
export const dynamic = 'force-dynamic';

const STATUS_TABS: { key: TicketStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

export default async function SupportConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'SUPPORT' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const sp = await searchParams;
  const status =
    STATUS_TABS.some((t) => t.key === sp.status) && sp.status !== 'ALL'
      ? (sp.status as TicketStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const [stats, queue] = await Promise.all([
    fetchSupportStats(),
    fetchSupportQueue({ status, page }),
  ]);

  const tickets = queue?.items ?? [];
  const total = queue?.total ?? 0;

  const columns: DataTableColumn<TicketListItem>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (t) => (
        <Link href={`/support/tickets/${t.id}`} className="font-medium text-primary hover:underline">
          {t.subject}
        </Link>
      ),
    },
    { key: 'priority', header: 'Priority', render: (t) => <PriorityPill priority={t.priority} /> },
    { key: 'status', header: 'Status', render: (t) => <StatusPill status={t.status} /> },
    {
      key: 'category',
      header: 'Category',
      render: (t) => <span className="text-sm text-text-muted">{t.category.replace('_', ' ')}</span>,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (t) =>
        t.assignedToName ? (
          <span className="text-sm">{t.assignedToName}</span>
        ) : (
          <span className="text-sm text-text-muted">Unassigned</span>
        ),
    },
    { key: 'sla', header: 'SLA', render: (t) => <SlaBadge slaDueAt={t.slaDueAt} overdue={t.overdue} /> },
  ];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <FadeUp>
          <PageHeader
            title="Support console"
            subtitle="Resolve customer complaints, escalations, and account issues."
          />
        </FadeUp>

        {/* KPI + signal row */}
        <StaggerList className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatsCard label="Open" value={stats?.open ?? 0} icon={LifeBuoy} variant="teal" href="/support?status=OPEN" />
          <StatsCard label="Overdue" value={stats?.overdue ?? 0} icon={AlertTriangle} variant="warning" />
          <StatsCard label="Unassigned" value={stats?.unassigned ?? 0} icon={Clock} />
          <StatsCard label="Resolved today" value={stats?.resolvedToday ?? 0} icon={CheckCircle2} variant="success" />
          <StatsCard
            label="Abuse reports"
            value={stats?.openChatReports ?? 0}
            icon={Flag}
            variant="warning"
            href="/support/reports"
          />
          <StatsCard label="Disputes" value={stats?.disputedBookings ?? 0} icon={Scale} />
        </StaggerList>

        {(stats?.pendingKycAppeals ?? 0) > 0 && (
          <FadeUp>
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {stats?.pendingKycAppeals} KYC appeal(s) pending review in the admin KYC console.
            </div>
          </FadeUp>
        )}

        {/* Status filter tabs */}
        <FadeUp>
          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
            {STATUS_TABS.map((tab) => {
              const active = (tab.key === 'ALL' && !status) || tab.key === status;
              return (
                <Link
                  key={tab.key}
                  href={tab.key === 'ALL' ? '/support' : `/support?status=${tab.key}`}
                  className={
                    active
                      ? 'rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white'
                      : 'rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-text-muted hover:border-gold/40'
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </FadeUp>

        <FadeUp>
          <DataTable
            columns={columns}
            data={tickets}
            rowKey={(t) => t.id}
            empty={{
              title: 'No tickets here',
              description: status
                ? `No ${status.toLowerCase()} tickets right now.`
                : 'The queue is clear. New complaints will appear here.',
            }}
          />
          {total > tickets.length && (
            <p className="mt-3 text-center text-xs text-text-muted">
              Showing {tickets.length} of {total} tickets
            </p>
          )}
        </FadeUp>
      </main>
    </PageTransition>
  );
}
