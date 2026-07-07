import { getTranslations } from 'next-intl/server';
import { CalendarDays, ArrowLeft, ArrowRight, AlertTriangle, ListTodo } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchManagedWeddings } from '@/lib/coordinator-api';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ManagedWeddingSummary } from '@smartshaadi/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('coordinator');
  return { title: t('calendarTitle') };
}

interface AgendaEntry {
  wedding: ManagedWeddingSummary;
  /** The soonest known date for this wedding (next ceremony, else wedding date). */
  date: Date | null;
  daysUntil: number | null;
}

type BucketKey = 'week' | 'month' | 'later' | 'tbc';
const BUCKET_LABELS: Record<BucketKey, string> = {
  week: 'This week',
  month: 'This month',
  later: 'Later',
  tbc: 'Date to be confirmed',
};

function bucketFor(days: number | null): BucketKey {
  if (days === null) return 'tbc';
  if (days <= 7) return 'week';
  if (days <= 31) return 'month';
  return 'later';
}

export default async function CoordinatorCalendarPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'EVENT_COORDINATOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('coordinator');

  const data = await fetchManagedWeddings();
  const weddings = data?.weddings ?? [];

  const entries: AgendaEntry[] = weddings
    .map((w) => {
      const iso = w.nextCeremony?.date ?? w.weddingDate;
      return { wedding: w, date: iso ? new Date(iso) : null, daysUntil: w.daysUntil };
    })
    .sort((a, b) => {
      if (a.daysUntil === null) return 1;
      if (b.daysUntil === null) return -1;
      return a.daysUntil - b.daysUntil;
    });

  const buckets: Record<BucketKey, AgendaEntry[]> = { week: [], month: [], later: [], tbc: [] };
  for (const e of entries) buckets[bucketFor(e.daysUntil)].push(e);
  const order: BucketKey[] = ['week', 'month', 'later', 'tbc'];

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
          icon={CalendarDays}
          title={t('calendarTitle')}
          subtitle="Upcoming ceremonies across every wedding you coordinate, soonest first."
        />

        <div className="mt-6 space-y-6">
          {weddings.length === 0 ? (
            <FadeUp>
              <div className="rounded-xl border border-gold/20 bg-surface shadow-card">
                <EmptyState variant="no-coordinator-weddings" />
              </div>
            </FadeUp>
          ) : (
            order
              .filter((k) => buckets[k].length > 0)
              .map((k, gi) => (
                <FadeUp key={k} delay={0.05 * (gi + 1)}>
                  <section>
                    <h2 className="mb-3 flex items-center gap-2 border-b border-gold/20 pb-2 font-heading text-lg text-primary">
                      {BUCKET_LABELS[k]}
                      <span className="text-sm font-normal text-text-muted">({buckets[k].length})</span>
                    </h2>
                    <ul className="space-y-3">
                      {buckets[k].map(({ wedding: w, date }) => (
                        <li key={w.weddingId}>
                          <Link
                            href={`/weddings/${w.weddingId}/ceremonies`}
                            className="group flex items-center gap-4 rounded-xl border border-gold/20 bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                          >
                            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-gold/25 bg-gold/5 text-center">
                              {date ? (
                                <>
                                  <span className="text-lg font-semibold leading-none text-primary">
                                    {date.toLocaleDateString('en-IN', { day: 'numeric' })}
                                  </span>
                                  <span className="text-[11px] uppercase text-gold-muted">
                                    {date.toLocaleDateString('en-IN', { month: 'short' })}
                                  </span>
                                </>
                              ) : (
                                <CalendarDays className="h-5 w-5 text-gold-muted" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-primary">{w.title}</p>
                              <p className="text-sm text-text-muted">
                                {w.nextCeremony
                                  ? `${w.nextCeremony.type.replace(/_/g, ' ').toLowerCase()} · `
                                  : ''}
                                {w.daysUntil !== null
                                  ? w.daysUntil === 0
                                    ? 'Today'
                                    : `in ${w.daysUntil} day${w.daysUntil === 1 ? '' : 's'}`
                                  : 'Date to be confirmed'}
                                {' · '}
                                {w.ceremoniesCount} ceremon{w.ceremoniesCount === 1 ? 'y' : 'ies'}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                {w.openTasks > 0 && (
                                  <span className="inline-flex items-center gap-1 text-gold-muted">
                                    <ListTodo className="h-3.5 w-3.5" /> {w.openTasks} open task{w.openTasks === 1 ? '' : 's'}
                                  </span>
                                )}
                                {w.openIncidents > 0 && (
                                  <span className="inline-flex items-center gap-1 text-warning">
                                    <AlertTriangle className="h-3.5 w-3.5" /> {w.openIncidents} incident{w.openIncidents === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                            </div>
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
