import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { LifeBuoy, AlertTriangle, Clock, CheckCircle2, Flag, Scale, ShieldAlert } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { RoleHero } from '@/components/shared/RoleHero';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PriorityPill, StatusPill, SlaBadge } from '@/components/support/badges';
import { SupportFilters } from '@/components/support/SupportFilters.client';
import { NewTicketButton } from '@/components/support/NewTicketButton.client';
import {
  fetchSupportQueue,
  fetchSupportStats,
  type TicketListItem,
  type TicketStatus,
  type TicketPriority,
  type TicketSource,
} from '@/lib/support-api';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('support');
  return { title: t('title') };
}

// Validation only — display labels are built inside the component (need `t`).
const STATUS_KEYS: (TicketStatus | 'ALL')[] = ['ALL', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];

const PRIORITY_VALUES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const SOURCE_VALUES: TicketSource[] = ['USER', 'CHAT_REPORT', 'DISPUTE', 'KYC_APPEAL', 'SYSTEM'];

export default async function SupportConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string; priority?: string; source?: string; mine?: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'SUPPORT' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('support');

  const sp = await searchParams;
  const status =
    STATUS_KEYS.includes(sp.status as TicketStatus | 'ALL') && sp.status !== 'ALL'
      ? (sp.status as TicketStatus)
      : undefined;
  const priority = PRIORITY_VALUES.includes(sp.priority as TicketPriority) ? (sp.priority as TicketPriority) : undefined;
  const source = SOURCE_VALUES.includes(sp.source as TicketSource) ? (sp.source as TicketSource) : undefined;
  const mine = sp.mine === 'true';
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const statusTabs: { key: TicketStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: t('filters.all') },
    { key: 'OPEN', label: t('filters.open') },
    { key: 'PENDING', label: t('filters.pending') },
    { key: 'RESOLVED', label: t('filters.resolved') },
    { key: 'CLOSED', label: t('filters.closed') },
  ];

  const [stats, queue] = await Promise.all([
    fetchSupportStats(),
    fetchSupportQueue({
      status, page,
      ...(priority ? { priority } : {}),
      ...(source ? { source } : {}),
      ...(mine ? { mine } : {}),
      ...(q ? { q } : {}),
    }),
  ]);

  const tickets = queue?.items ?? [];
  const total = queue?.total ?? 0;

  const columns: DataTableColumn<TicketListItem>[] = [
    {
      key: 'subject',
      header: t('columns.subject'),
      render: (row) => (
        <Link href={`/support/tickets/${row.id}`} className="font-medium text-primary hover:underline">
          {row.subject}
        </Link>
      ),
    },
    { key: 'priority', header: t('filters.priority'), render: (row) => <PriorityPill priority={row.priority} /> },
    { key: 'status', header: t('columns.status'), render: (row) => <StatusPill status={row.status} /> },
    {
      key: 'category',
      header: t('columns.category'),
      render: (row) => <span className="text-sm text-text-muted">{row.category.replace('_', ' ')}</span>,
    },
    {
      key: 'assignee',
      header: t('columns.assignee'),
      render: (row) =>
        row.assignedToName ? (
          <span className="text-sm">{row.assignedToName}</span>
        ) : (
          <span className="text-sm text-text-muted">{t('stats.unassigned')}</span>
        ),
    },
    { key: 'sla', header: t('columns.sla'), render: (row) => <SlaBadge slaDueAt={row.slaDueAt} overdue={row.overdue} /> },
  ];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <RoleHero
            icon={LifeBuoy}
            title={t('title')}
            subtitle={t('subtitle')}
            rightSlot={<NewTicketButton />}
          />
        </div>

        {/* KPI + signal row */}
        <StaggerList className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatsCard label={t('stats.open')} value={stats?.open ?? 0} icon={LifeBuoy} variant="teal" href="/support?status=OPEN" />
          <StatsCard label={t('stats.overdue')} value={stats?.overdue ?? 0} icon={AlertTriangle} variant="warning" />
          <StatsCard label={t('stats.unassigned')} value={stats?.unassigned ?? 0} icon={Clock} />
          <StatsCard label={t('stats.resolvedToday')} value={stats?.resolvedToday ?? 0} icon={CheckCircle2} variant="success" />
          <StatsCard
            label={t('stats.abuse')}
            value={stats?.openChatReports ?? 0}
            icon={Flag}
            variant="warning"
            href="/support/reports"
          />
          <StatsCard label={t('stats.disputes')} value={stats?.disputedBookings ?? 0} icon={Scale} />
        </StaggerList>

        {(stats?.pendingKycAppeals ?? 0) > 0 && (
          <FadeUp>
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {t('kycAppealsBanner', { count: stats?.pendingKycAppeals ?? 0 })}
            </div>
          </FadeUp>
        )}

        {/* Status filter tabs */}
        <FadeUp>
          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
            {statusTabs.map((tab) => {
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
          <SupportFilters />
          <DataTable
            columns={columns}
            data={tickets}
            rowKey={(row) => row.id}
            empty={{
              title: t('empty.title'),
              description: status
                ? t('empty.filtered', { status: statusTabs.find((tab) => tab.key === status)?.label ?? status })
                : t('empty.default'),
            }}
          />
          {total > 0 && (
            <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Pagination">
              {page > 1 && (
                <Link
                  href={`/support?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page - 1) }).toString()}`}
                  className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm text-primary hover:border-gold/40"
                >
                  {t('pagination.previous')}
                </Link>
              )}
              <span className="text-xs text-text-muted">
                {t('pagination.summary', { page, count: total })}
              </span>
              {page * 25 < total && (
                <Link
                  href={`/support?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page + 1) }).toString()}`}
                  className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm text-primary hover:border-gold/40"
                >
                  {t('pagination.next')}
                </Link>
              )}
            </nav>
          )}
        </FadeUp>
      </main>
    </PageTransition>
  );
}
