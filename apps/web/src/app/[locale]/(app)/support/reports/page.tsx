import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Flag } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { ReportActions } from '@/components/support/ReportActions.client';
import { fetchChatReports } from '@/lib/support-api';

export const metadata = { title: 'Abuse reports · Support' };
export const dynamic = 'force-dynamic';

export default async function SupportReportsPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'SUPPORT' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const data = await fetchChatReports('OPEN');
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

        {reports.length === 0 ? (
          <FadeUp>
            <EmptyState
              icon={Flag}
              title="No open reports"
              description="Flagged conversations will appear here for triage."
            />
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
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                        <Flag className="h-3 w-3" /> {r.reason}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-text-muted">
                      Conversation <span className="font-mono text-primary">{r.matchRequestId}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      Reported by <span className="font-mono text-primary">{r.reporterProfileId}</span>
                    </p>
                  </div>
                  <ReportActions reportId={r.id} />
                </div>
              </div>
            ))}
          </StaggerList>
        )}
      </main>
    </PageTransition>
  );
}
