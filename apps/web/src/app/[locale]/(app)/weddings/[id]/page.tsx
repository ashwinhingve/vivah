import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { Calendar, Wallet, Users, Sparkles, ListChecks, ArrowRight } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { formatINRCompact, formatDateIN, daysUntil } from '@/lib/format';
import type { WeddingSummary, WeddingPlan, Ceremony, MuhuratDate } from '@smartshaadi/types';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { ActivityFeed } from '@/components/wedding/ActivityFeed';
import { WeddingHero } from '@/components/wedding/WeddingHero';
import { WeddingReadinessCard, type ReadinessMilestone } from '@/components/wedding/WeddingReadinessCard';
import { QuickActionsGrid } from '@/components/wedding/QuickActionsGrid';
import { CeremonyForm } from './CeremonyForm.client';
import { WeddingHeaderActions } from './WeddingHeaderActions.client';
import {
  createCeremonyAction,
  deleteCeremonyAction,
  updateCeremonyAction,
  selectMuhuratAction,
  updateWeddingAction,
  cancelWeddingAction,
  deleteWeddingAction,
} from './actions';

// ── constants ─────────────────────────────────────────────────────────────────

const CEREMONY_LABELS: Record<string, string> = {
  HALDI: 'Haldi',
  MEHNDI: 'Mehndi',
  SANGEET: 'Sangeet',
  WEDDING: 'Wedding',
  RECEPTION: 'Reception',
  ENGAGEMENT: 'Engagement',
  OTHER: 'Other',
};

const CEREMONY_COLORS: Record<string, string> = {
  HALDI: 'bg-warning/15 text-warning',
  MEHNDI: 'bg-success/15 text-success',
  SANGEET: 'bg-primary/15 text-primary',
  WEDDING: 'bg-primary/20 text-primary',
  RECEPTION: 'bg-teal/10 text-teal',
  ENGAGEMENT: 'bg-teal/15 text-teal',
  OTHER: 'bg-secondary text-foreground',
};

/** Display name for a ceremony — OTHER types show the user's custom label. */
function ceremonyLabel(c: { type: string; customTypeName: string | null }): string {
  if (c.type === 'OTHER' && c.customTypeName) return c.customTypeName;
  return CEREMONY_LABELS[c.type] ?? c.type;
}

// ── data fetchers ─────────────────────────────────────────────────────────────

type WeddingDetail = WeddingSummary & { plan?: WeddingPlan };

async function fetchWedding(id: string): Promise<WeddingDetail | null> {
  return fetchAuth<WeddingDetail>(`/api/v1/weddings/${id}`);
}

async function fetchCeremonies(id: string): Promise<Ceremony[]> {
  const data = await fetchAuth<{ ceremonies: Ceremony[] }>(`/api/v1/weddings/${id}/ceremonies`);
  return data?.ceremonies ?? [];
}

async function fetchMuhurat(id: string): Promise<MuhuratDate[]> {
  const data = await fetchAuth<{ suggestions: MuhuratDate[] }>(`/api/v1/weddings/${id}/muhurat`);
  return data?.suggestions ?? [];
}

// ── page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.detail.metadata' });
  return { title: t('title') };
}

export default async function WeddingOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const [wedding, ceremonies, muhuratSuggestions] = await Promise.all([
    fetchWedding(id),
    fetchCeremonies(id),
    fetchMuhurat(id),
  ]);

  if (!wedding) notFound();

  const { total = 0, done = 0 } = wedding.taskProgress ?? {};
  const taskPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const selectedMuhurat = muhuratSuggestions.find((d) => d.selected);
  const today = new Date().toISOString().slice(0, 10);

  const effectiveDate = selectedMuhurat?.date ?? wedding.weddingDate ?? null;
  const days = daysUntil(effectiveDate);

  const budgetTotal = wedding.plan?.budget?.total ?? wedding.budgetTotal ?? 0;
  const budgetSpent =
    wedding.plan?.budget?.categories?.reduce((s, c) => s + (c.spent ?? 0), 0) ?? 0;

  // Upcoming ceremonies (next 3, future first)
  const upcomingCeremonies = ceremonies
    .filter((c) => c.date && c.date >= today)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 3);

  // Planning readiness — five essentials that map cleanly to a section.
  const milestones: ReadinessMilestone[] = [
    { key: 'date', label: 'Date', done: Boolean(effectiveDate), seg: 'timeline' },
    { key: 'ceremonies', label: 'Ceremonies', done: ceremonies.length > 0, seg: 'ceremonies' },
    { key: 'guests', label: 'Guests', done: wedding.guestCount > 0, seg: 'guests' },
    { key: 'budget', label: 'Budget', done: budgetTotal > 0, seg: 'budget' },
    { key: 'tasks', label: 'Tasks', done: total > 0, seg: 'tasks' },
  ];
  const readinessPct = Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);

  return (
    <PageTransition className="space-y-6 px-4 py-6 lg:px-0 lg:py-0">
      {/* Invitation hero */}
      <FadeUp delay={0}>
        <WeddingHero
          weddingName={wedding.weddingName ?? wedding.venueName ?? 'Wedding plan'}
          effectiveDate={effectiveDate}
          venueName={wedding.venueName ?? null}
          venueCity={wedding.venueCity ?? null}
          status={wedding.status}
          days={days}
          muhuratSelected={Boolean(selectedMuhurat)}
          readinessPct={readinessPct}
          actions={
            <WeddingHeaderActions
              wedding={{
                weddingName: wedding.weddingName ?? null,
                weddingDate: wedding.weddingDate ?? null,
                venueName: wedding.venueName ?? null,
                venueCity: wedding.venueCity ?? null,
                venueAddress: wedding.venueAddress ?? null,
                budgetTotal: wedding.budgetTotal ?? null,
              }}
              editAction={updateWeddingAction.bind(null, id)}
              cancelAction={cancelWeddingAction.bind(null, id)}
              deleteAction={deleteWeddingAction.bind(null, id)}
            />
          }
        />
      </FadeUp>

      {/* Stat row */}
      <StaggerList className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          label="Budget spent"
          value={formatINRCompact(budgetSpent)}
          sub={budgetTotal > 0 ? `of ${formatINRCompact(budgetTotal)}` : 'no budget set'}
          icon={Wallet}
          variant="gold"
          href={`/weddings/${id}/budget`}
        />
        <StatsCard
          label="Guests"
          value={wedding.guestCount}
          sub="on the list"
          icon={Users}
          variant="teal"
          href={`/weddings/${id}/guests`}
        />
        <StatsCard
          label="Ceremonies"
          value={ceremonies.length}
          sub="planned"
          icon={Sparkles}
          variant="default"
          href={`/weddings/${id}/ceremonies`}
        />
        <StatsCard
          label="Tasks done"
          value={taskPct}
          valuePercent={taskPct}
          sub={`${done}/${total} complete`}
          icon={ListChecks}
          variant="success"
          href={`/weddings/${id}/tasks`}
        />
      </StaggerList>

      {/* Quick actions */}
      <FadeUp delay={0.1}>
        <SectionHeader title="Quick actions" />
        <QuickActionsGrid id={id} />
      </FadeUp>

      {/* Readiness + Muhurat (two-up on desktop) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FadeUp delay={0.15}>
          <WeddingReadinessCard id={id} pct={readinessPct} milestones={milestones} />
        </FadeUp>

        {muhuratSuggestions.length > 0 && (
          <FadeUp delay={0.2}>
            <Accordion
              type="single"
              collapsible
              defaultValue={selectedMuhurat ? undefined : 'muhurat'}
              className="rounded-2xl border border-gold/25 bg-surface px-5 shadow-card"
            >
              <AccordionItem value="muhurat" className="border-b-0">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gold" aria-hidden="true" />
                    Auspicious dates
                    {selectedMuhurat && (
                      <Badge variant="success" className="ml-1">
                        Date selected
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {muhuratSuggestions.map((d) => (
                    <div
                      key={d.date}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                        d.selected ? 'border-gold bg-gold/10' : 'border-gold/20 bg-background'
                      }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            d.selected ? 'text-gold-muted' : 'text-foreground'
                          }`}
                        >
                          {d.muhurat}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateIN(d.date)}
                          {d.tithi ? ` · ${d.tithi}` : ''}
                        </p>
                      </div>
                      {!d.selected ? (
                        <form action={selectMuhuratAction.bind(null, id)}>
                          <input type="hidden" name="date" value={d.date} />
                          <input type="hidden" name="muhurat" value={d.muhurat} />
                          {d.tithi && <input type="hidden" name="tithi" value={d.tithi} />}
                          <button
                            type="submit"
                            className="min-h-[44px] rounded-lg border border-gold px-3 text-xs font-medium text-primary transition-colors hover:bg-gold/10"
                          >
                            Select
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-semibold text-gold-muted">✓ Selected</span>
                      )}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </FadeUp>
        )}
      </div>

      {/* Upcoming ceremonies */}
      {upcomingCeremonies.length > 0 && (
        <FadeUp delay={0.25}>
          <SectionHeader
            title="Upcoming ceremonies"
            viewAllHref={`/weddings/${id}/ceremonies`}
            viewAllLabel="All ceremonies"
          />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {upcomingCeremonies.map((c) => {
              const colorClass = CEREMONY_COLORS[c.type] ?? CEREMONY_COLORS['OTHER']!;
              const cdDays = daysUntil(c.date);
              return (
                <div
                  key={c.id}
                  className="min-w-[200px] max-w-[220px] shrink-0 rounded-2xl border border-gold/20 bg-surface p-4 shadow-card"
                >
                  <span
                    className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                  >
                    {ceremonyLabel(c)}
                  </span>
                  {c.date && <p className="text-sm font-semibold text-foreground">{formatDateIN(c.date)}</p>}
                  {c.startTime && <p className="text-xs text-muted-foreground">{c.startTime}</p>}
                  {c.venue && <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.venue}</p>}
                  {cdDays !== null && cdDays > 0 && (
                    <p className="mt-2 text-xs font-semibold text-primary">{cdDays} days away</p>
                  )}
                </div>
              );
            })}
          </div>
        </FadeUp>
      )}

      {/* All ceremonies — inline add/edit/delete */}
      <FadeUp delay={0.3}>
        <div className="rounded-2xl border border-gold/25 bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-primary">All ceremonies</h2>
            <Link
              href={`/weddings/${id}/ceremonies`}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal transition-colors hover:text-teal-hover"
            >
              Full timeline
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {ceremonies.length === 0 ? (
            <EmptyState
              variant="no-tasks"
              title="No ceremonies added yet"
              description="Add ceremonies to build out your wedding-day timeline."
              className="py-8"
            />
          ) : (
            <ul className="mb-4 space-y-2">
              {ceremonies.map((c) => {
                const colorClass = CEREMONY_COLORS[c.type] ?? CEREMONY_COLORS['OTHER']!;
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-3 rounded-lg border border-gold/20 px-4 py-3"
                  >
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {ceremonyLabel(c)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {c.date && <p className="text-sm font-medium text-foreground">{formatDateIN(c.date)}</p>}
                      {c.startTime && <p className="text-xs text-muted-foreground">{c.startTime}</p>}
                      {c.venue && <p className="text-xs text-muted-foreground">{c.venue}</p>}
                    </div>
                    <details className="shrink-0">
                      <summary className="min-h-[44px] cursor-pointer list-none rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/30 hover:text-primary">
                        Edit
                      </summary>
                      <form
                        action={updateCeremonyAction.bind(null, id, c.id)}
                        className="absolute left-2 right-2 z-10 mt-1 space-y-2 rounded-lg border border-gold/30 bg-surface p-3 shadow-lg sm:left-auto sm:right-2 sm:w-64"
                      >
                        {c.type === 'OTHER' && (
                          <div>
                            <label className="mb-1 block text-2xs font-medium text-muted-foreground">
                              Ceremony name
                            </label>
                            <input
                              name="customTypeName"
                              type="text"
                              defaultValue={c.customTypeName ?? ''}
                              placeholder="e.g. Manda"
                              className="w-full rounded border border-gold/30 px-2 py-1 text-xs"
                            />
                          </div>
                        )}
                        <div>
                          <label className="mb-1 block text-2xs font-medium text-muted-foreground">Date</label>
                          <input
                            name="date"
                            type="date"
                            min={today}
                            defaultValue={c.date ?? ''}
                            className="w-full rounded border border-gold/30 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-2xs font-medium text-muted-foreground">Start</label>
                          <input
                            name="startTime"
                            type="time"
                            defaultValue={c.startTime ?? ''}
                            className="w-full rounded border border-gold/30 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-2xs font-medium text-muted-foreground">Venue</label>
                          <input
                            name="venue"
                            type="text"
                            defaultValue={c.venue ?? ''}
                            className="w-full rounded border border-gold/30 px-2 py-1 text-xs"
                          />
                        </div>
                        <button
                          type="submit"
                          className="min-h-[44px] w-full rounded-lg bg-primary py-1.5 text-xs text-white"
                        >
                          Save
                        </button>
                      </form>
                    </details>
                    <form action={deleteCeremonyAction.bind(null, id, c.id)}>
                      <button
                        type="submit"
                        aria-label={`Delete ${ceremonyLabel(c)} ceremony`}
                        className="min-h-[44px] rounded-md border border-transparent px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:text-destructive"
                      >
                        Delete
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <CeremonyForm action={createCeremonyAction.bind(null, id)} />
        </div>
      </FadeUp>

      {/* Recent activity */}
      <FadeUp delay={0.35}>
        <SectionHeader title="Recent activity" />
        <ActivityFeed weddingId={id} limit={8} />
      </FadeUp>
    </PageTransition>
  );
}
