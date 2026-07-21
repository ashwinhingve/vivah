import { getTranslations, getLocale } from 'next-intl/server';
import { Inbox, ArrowLeft, ArrowRight, AlertTriangle, ListTodo } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchCoordinatorTasks } from '@/lib/coordinator-api';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CoordinatorTaskInboxItem, IncidentSeverity } from '@smartshaadi/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('coordinator');
  return { title: t('tasksTitle') };
}

type BucketKey = 'urgent' | 'overdue' | 'week' | 'later';

const SEVERITY_TONES: Record<IncidentSeverity, StatusTone> = {
  CRITICAL: 'error',
  HIGH:     'warning',
  MEDIUM:   'gold',
  LOW:      'neutral',
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// Mirrors the server-side urgency ordering in coordinator.service.ts —
// CRITICAL/HIGH incidents lead, then due-date buckets, then the rest.
function bucketFor(item: CoordinatorTaskInboxItem): BucketKey {
  if (item.kind === 'INCIDENT' && (item.severity === 'CRITICAL' || item.severity === 'HIGH')) return 'urgent';
  if (item.kind === 'TASK' && item.dueDate) {
    const d = daysUntil(item.dueDate);
    if (d < 0) return 'overdue';
    if (d <= 7) return 'week';
  }
  return 'later';
}

function itemHref(item: CoordinatorTaskInboxItem): string {
  return item.kind === 'TASK'
    ? `/weddings/${item.weddingId}/tasks`
    : `/weddings/${item.weddingId}/incidents`;
}

export default async function CoordinatorTasksPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'EVENT_COORDINATOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('coordinator');
  const locale = await getLocale();
  const dateLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const bucketLabels: Record<BucketKey, string> = {
    urgent: t('buckets.urgent'),
    overdue: t('buckets.overdue'),
    week: t('buckets.week'),
    later: t('buckets.later'),
  };

  const data = await fetchCoordinatorTasks();
  const items = data?.items ?? [];

  const buckets: Record<BucketKey, CoordinatorTaskInboxItem[]> = { urgent: [], overdue: [], week: [], later: [] };
  for (const item of items) buckets[bucketFor(item)].push(item);
  const order: BucketKey[] = ['urgent', 'overdue', 'week', 'later'];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
        <FadeUp>
          <Link
            href="/coordinator"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {t('title')}
          </Link>
        </FadeUp>

        <RoleHero
          icon={Inbox}
          title={t('tasksTitle')}
          subtitle={t('tasksSubtitle')}
        />

        <div className="mt-6 space-y-6">
          {items.length === 0 ? (
            <FadeUp>
              <div className="rounded-2xl border border-gold/20 bg-surface shadow-card">
                <EmptyState variant="no-tasks" title={t('emptyTasks.title')} description={t('emptyTasks.description')} />
              </div>
            </FadeUp>
          ) : (
            order
              .filter((k) => buckets[k].length > 0)
              .map((k, gi) => (
                <FadeUp key={k} delay={0.05 * (gi + 1)}>
                  <section>
                    <h2 className="mb-3 flex items-center gap-2 border-b border-gold/20 pb-2 font-heading text-lg text-primary">
                      {bucketLabels[k]}
                      <span className="text-sm font-normal text-text-muted">({buckets[k].length})</span>
                    </h2>
                    <ul className="space-y-3">
                      {buckets[k].map((item) => (
                        <li key={`${item.kind}-${item.id}`}>
                          <Link
                            href={itemHref(item)}
                            className="group flex items-center gap-4 rounded-2xl border border-gold/20 bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/5">
                              {item.kind === 'TASK' ? (
                                <ListTodo className="h-5 w-5 text-gold-muted" aria-hidden="true" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-primary">{item.title}</p>
                              <p className="text-sm text-text-muted">
                                {item.weddingTitle}
                                {item.kind === 'TASK' && item.dueDate
                                  ? ` · ${t('due')} ${new Date(item.dueDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}`
                                  : ''}
                              </p>
                            </div>
                            {item.kind === 'INCIDENT' && item.severity ? (
                              <StatusChip
                                tone={SEVERITY_TONES[item.severity]}
                                className="shrink-0"
                              >
                                {t(`severity.${item.severity}`)}
                              </StatusChip>
                            ) : null}
                            <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                </FadeUp>
              ))
          )}
        </div>
      </main>
    </PageTransition>
  );
}
