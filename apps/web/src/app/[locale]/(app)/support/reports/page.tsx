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

export const metadata = { title: 'Abuse reports · Support' };
export const dynamic = 'force-dynamic';

// Mirrors ChatReport's Mongo status enum — apps/api/src/infrastructure/mongo/models/ChatReport.ts
const REPORT_STATUS_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'REVIEWED', label: 'Reviewed' },
  { key: 'DISMISSED', label: 'Dismissed' },
];

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

  const sp = await searchParams;
  const status =
    REPORT_STATUS_TABS.some((t) => t.key === sp.status) && sp.status !== 'ALL' ? sp.status : undefined;

  const data = await fetchChatReports(status);
  const reports = data?.reports ?? [];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
        <FadeUp>
          <Link
            href="/support"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Link>
          <PageHeader
            title="Chat abuse reports"
            subtitle="Review flagged conversations. Dismiss false reports or escalate genuine abuse into a tracked ticket."
          />
        </FadeUp>

        <FadeUp>
          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
            {REPORT_STATUS_TABS.map((tab) => {
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
            <EmptyState variant="no-reports" />
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
                    {/* ChatReport only captures the reporter + conversation id — no reported-party
                        id or message snippet at capture time (see ChatReport.ts). A content preview
                        needs a schema change (store a message excerpt + reported profileId on
                        report creation) before this can show more than raw ids. */}
                    <p className="mt-2 text-xs text-text-muted">
                      Conversation <span className="font-mono text-primary">{r.matchRequestId}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      Reported by <span className="font-mono text-primary">{r.reporterProfileId}</span>
                    </p>
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
