import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchManagedWeddings } from '@/lib/coordinator-api';
import { formatDateIN } from '@/lib/format';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';
import {
  CalendarCheck,
  ClipboardList,
  AlertTriangle,
  CalendarClock,
  Search,
  CalendarDays,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('coordinator');
  return { title: t('title') };
}

export default async function CoordinatorDashboardPage() {
  // Role guard — middleware does the same check, but the page guard prevents
  // any leak if matcher config drifts. Mirrors apps/web/src/app/(app)/admin/page.tsx.
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'EVENT_COORDINATOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('coordinator');

  const data = await fetchManagedWeddings();
  const weddings = data?.weddings ?? [];

  const openTasksTotal = weddings.reduce((sum, w) => sum + w.openTasks, 0);
  const openIncidentsTotal = weddings.reduce((sum, w) => sum + w.openIncidents, 0);
  const thisWeekCount = weddings.filter((w) => w.daysUntil !== null && w.daysUntil <= 7).length;

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6 space-y-7">

          {/* ── Hero Greeting ──────────────────────────────────── */}
          <FadeUp delay={0}>
            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-primary/5 via-surface to-gold/10 px-5 py-5 shadow-card sm:px-7 sm:py-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/8 blur-3xl"
              />
              <div className="relative">
                <h1 className="font-heading text-[22px] sm:text-[28px] font-semibold leading-tight tracking-tight text-primary">
                  {t('title')}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  {t('subtitle')}
                </p>
              </div>
            </div>
          </FadeUp>

          {/* ── Stat Cards ─────────────────────────────────────── */}
          <StaggerList className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
            <StatsCard
              label={t('stats.managed')}
              value={weddings.length}
              sub={t('stats.managedSub')}
              icon={CalendarCheck}
              variant="teal"
              animDelayMs={0}
              href="/coordinator/calendar"
            />
            <StatsCard
              label={t('stats.tasks')}
              value={openTasksTotal}
              sub={t('stats.tasksSub')}
              icon={ClipboardList}
              variant="gold"
              animDelayMs={100}
              href="/coordinator/tasks"
            />
            <StatsCard
              label={t('stats.incidents')}
              value={openIncidentsTotal}
              sub={t('stats.incidentsSub')}
              icon={AlertTriangle}
              variant={openIncidentsTotal > 0 ? 'warning' : 'default'}
              animDelayMs={200}
              href="/coordinator/tasks"
            />
            <StatsCard
              label={t('stats.thisWeek')}
              value={thisWeekCount}
              sub={t('stats.thisWeekSub')}
              icon={CalendarClock}
              variant={thisWeekCount > 0 ? 'success' : 'default'}
              animDelayMs={300}
              href="/coordinator/calendar"
            />
          </StaggerList>

          {/* ── Managed Weddings ───────────────────────────────── */}
          <FadeUp delay={0.1}>
            <div className="mb-4 flex items-end justify-between gap-4 border-b border-gold/20 pb-2.5">
              <h2 className="font-heading text-xl font-semibold leading-tight tracking-tight text-foreground">
                {t('yourWeddings')}
              </h2>
            </div>

            {weddings.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title={t('emptyWeddings.title')}
                description={t('emptyWeddings.description')}
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {weddings.map((w) => {
                  const urgent = w.daysUntil !== null && w.daysUntil <= 7;
                  return (
                    <li
                      key={w.weddingId}
                      className={`group relative rounded-xl border p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                        urgent ? 'border-warning/40 bg-warning/5' : 'border-gold/20 bg-surface'
                      }`}
                    >
                      {/* Stretched link: whole card opens day-of, but the task/incident
                          pills below are separate links, so they must live outside this
                          anchor (no nested <a>) — sibling, positioned to fill the card. */}
                      <Link
                        href={`/weddings/${w.weddingId}/day-of`}
                        aria-label={`${w.title} — day-of dashboard`}
                        className="absolute inset-0 z-0 rounded-xl"
                      />

                      <div className="relative z-[1] pointer-events-none">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-heading text-lg font-semibold text-primary line-clamp-1 group-hover:text-primary">
                            {w.title}
                          </h3>
                          <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {w.scope}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDateIN(w.weddingDate)}
                          {w.daysUntil !== null ? ` · ${w.daysUntil}d away` : ''}
                        </p>

                        <p className="mt-2 text-sm text-foreground">
                          {t('nextLabel')}{' '}
                          {w.nextCeremony
                            ? w.nextCeremony.type.replace(/_/g, ' ').toLowerCase()
                            : t('noCeremonyScheduled')}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2 pointer-events-auto">
                          <Link
                            href={`/weddings/${w.weddingId}/tasks`}
                            className="relative z-10 inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold-muted transition-colors hover:bg-gold/20"
                          >
                            <ClipboardList className="h-3 w-3" aria-hidden="true" />
                            {t('openTasksCount', { count: w.openTasks })}
                          </Link>
                          {w.openIncidents > 0 && (
                            <Link
                              href={`/weddings/${w.weddingId}/tasks`}
                              className="relative z-10 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning transition-colors hover:bg-warning/25"
                            >
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              {t('incidentsCount', { count: w.openIncidents })}
                            </Link>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {t('ceremoniesCount', { count: w.ceremoniesCount })}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </FadeUp>

          {/* ── Quick Actions ──────────────────────────────────── */}
          <FadeUp delay={0.2}>
            <div className="mb-4 border-b border-gold/20 pb-2.5">
              <h2 className="font-heading text-xl font-semibold leading-tight tracking-tight text-foreground">
                {t('quickActions')}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/coordinator/routing"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-teal/20 bg-teal/5 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-teal/10 hover:shadow-card-hover"
              >
                <Search className="h-5 w-5 text-teal" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {t('actions.routeVendors')}
                </span>
              </Link>
              <Link
                href="/coordinator/calendar"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-gold/30 bg-gold/10 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-gold/20 hover:shadow-card-hover"
              >
                <CalendarDays className="h-5 w-5 text-gold-muted" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {t('calendarTitle')}
                </span>
              </Link>
            </div>
          </FadeUp>

        </div>
      </main>
    </PageTransition>
  );
}
