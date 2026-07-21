import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Flag } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { ReportActions } from '@/components/support/ReportActions.client';
import { ReportSeverityPill } from '@/components/support/badges';
import { cn } from '@/lib/utils';
import { fetchChatReports } from '@/lib/support-api';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('support');
  return { title: t('reportsTitle') };
}

// Mirrors ChatReport's Mongo status enum — apps/api/src/infrastructure/mongo/models/ChatReport.ts
// Validation only — display labels are built inside the component (need `t`).
const REPORT_STATUS_KEYS = ['ALL', 'OPEN', 'REVIEWED', 'DISMISSED'];

const REPORT_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-warning/10 text-warning border-warning/30',
  REVIEWED: 'bg-success/10 text-success border-success/30',
  DISMISSED: 'bg-surface-muted text-text-muted border-border',
};

function ReportStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        REPORT_STATUS_STYLES[status] ?? REPORT_STATUS_STYLES['DISMISSED'],
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default async function SupportReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'SUPPORT' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('support');

  const sp = await searchParams;
  const status =
    REPORT_STATUS_KEYS.includes(sp.status ?? '') && sp.status !== 'ALL' ? sp.status : undefined;

  const data = await fetchChatReports(status);
  const reports = data?.reports ?? [];

  const reportStatusTabs: { key: string; label: string }[] = [
    { key: 'ALL', label: t('filters.all') },
    { key: 'OPEN', label: t('filters.open') },
    { key: 'REVIEWED', label: t('reports.reviewed') },
    { key: 'DISMISSED', label: t('reports.dismissed') },
  ];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
        <FadeUp>
          <Link
            href="/support"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {t('reports.backToQueue')}
          </Link>
          <PageHeader
            title={t('reportsTitle')}
            subtitle={t('reports.subtitle')}
          />
        </FadeUp>

        <FadeUp>
          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
            {reportStatusTabs.map((tab) => {
              const active = (tab.key === 'ALL' && !status) || tab.key === status;
              return (
                <Link
                  key={tab.key}
                  href={tab.key === 'ALL' ? '/support/reports' : `/support/reports?status=${tab.key}`}
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

        {reports.length === 0 ? (
          <FadeUp>
            <EmptyState variant="no-reports" title={t('reports.empty.title')} description={t('reports.empty.description')} />
          </FadeUp>
        ) : (
          <StaggerList className="space-y-3">
            {reports.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                        <Flag className="h-3 w-3" /> {r.reason}
                      </span>
                      <ReportSeverityPill reason={r.reason} />
                      {r.status !== 'OPEN' && <ReportStatusBadge status={r.status} />}
                      <span className="text-xs text-text-muted">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {/* Content preview — reporter/reported names + last-message excerpt are
                        now captured at report time (ChatReport.reportedProfileId/messageExcerpt)
                        and resolved staff-side in listChatReports. Falls back gracefully for
                        older reports that predate these fields. */}
                    {r.messageExcerpt && (
                      <p className="mt-2 border-l-2 border-gold/40 pl-3 text-sm italic text-text">
                        “{r.messageExcerpt}”
                      </p>
                    )}
                    <p className="mt-2 text-xs text-text-muted">
                      {t('reports.reportedByLabel')}{' '}
                      <span className="font-medium text-primary">{r.reporterName ?? r.reporterProfileId}</span>
                    </p>
                    {(r.reportedName || r.reportedProfileId) && (
                      <p className="text-xs text-text-muted">
                        {t('reports.reportedUserLabel')}{' '}
                        <span className="font-medium text-primary">{r.reportedName ?? r.reportedProfileId}</span>
                      </p>
                    )}
                  </div>
                  {r.status === 'OPEN' && <ReportActions reportId={r.id} />}
                </div>
              </div>
            ))}
          </StaggerList>
        )}
      </main>
    </PageTransition>
  );
}
