import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Calendar, MapPin, ArrowLeft,
  Sparkles, Plus, UserPlus, Store,
} from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { formatINR, formatDateIN, daysUntil } from '@/lib/format';
import type { WeddingSummary, WeddingPlan, Ceremony, MuhuratDate } from '@smartshaadi/types';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ActivityFeed } from '@/components/wedding/ActivityFeed';
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

const STATUS_LABELS: Record<string, string> = {
  PLANNING:  'Planning',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING:  'bg-warning/15 text-warning border-warning/30',
  CONFIRMED: 'bg-teal/10 text-teal border-teal/30',
  COMPLETED: 'bg-success/15 text-success border-success/30',
  CANCELLED: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

const CEREMONY_LABELS: Record<string, string> = {
  HALDI:      'Haldi',
  MEHNDI:     'Mehndi',
  SANGEET:    'Sangeet',
  WEDDING:    'Wedding',
  RECEPTION:  'Reception',
  ENGAGEMENT: 'Engagement',
  OTHER:      'Other',
};

const CEREMONY_COLORS: Record<string, string> = {
  HALDI:      'bg-warning/15 text-warning',
  MEHNDI:     'bg-success/15 text-success',
  SANGEET:    'bg-primary/15 text-primary',
  WEDDING:    'bg-primary/20 text-primary',
  RECEPTION:  'bg-teal/10 text-teal',
  ENGAGEMENT: 'bg-teal/15 text-teal',
  OTHER:      'bg-secondary text-foreground',
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
  const isFuture = days !== null && days > 0;

  // Budget derived values (plan is embedded in WeddingDetail from /api/v1/weddings/:id)
  const budgetSpent =
    wedding.plan?.budget?.categories?.reduce((s, c) => s + (c.spent ?? 0), 0) ?? 0;

  // Upcoming ceremonies (next 3, future first)
  const now = new Date().toISOString();
  const upcomingCeremonies = ceremonies
    .filter((c) => c.date && c.date >= now.slice(0, 10))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 3);

  const tabs = [
    { href: `/weddings/${id}/tasks`,      label: 'Tasks',      desc: 'Checklist & task assignments' },
    { href: `/weddings/${id}/budget`,     label: 'Budget',     desc: 'Allocate & track spend by category' },
    { href: `/weddings/${id}/expenses`,   label: 'Expenses',   desc: 'Log payments & receipts' },
    { href: `/weddings/${id}/guests`,     label: 'Guests',     desc: 'Guest list, RSVP & meal preferences' },
    { href: `/weddings/${id}/ceremonies`, label: 'Ceremonies', desc: 'All ceremonies & timeline' },
    { href: `/weddings/${id}/catering`,   label: 'Catering',   desc: 'Menu & headcount estimates' },
    { href: `/weddings/${id}/seating`,    label: 'Seating',    desc: 'Tables & seat assignments' },
    { href: `/weddings/${id}/timeline`,   label: 'Schedule',   desc: 'Day-of timeline & run sheet' },
    { href: `/weddings/${id}/vendors`,    label: 'Vendors',    desc: 'Assigned vendors for your wedding' },
    { href: `/weddings/${id}/moodboard`,  label: 'Mood Board', desc: 'Save inspiration photos & color palette' },
    { href: `/weddings/${id}/documents`,  label: 'Docs',       desc: 'Contracts, permits & invoices' },
    { href: `/weddings/${id}/registry`,   label: 'Registry',   desc: 'Gift registry & wishlist' },
    { href: `/weddings/${id}/website`,    label: 'Website',    desc: 'Public wedding microsite' },
    { href: `/weddings/${id}/members`,    label: 'Members',    desc: 'Collaborators & access' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">

        {/* Back link */}
        <Link
          href="/weddings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All Weddings
        </Link>

        {/* Hero block */}
        <FadeUp delay={0}>
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="min-w-0 flex-1">
              {/* Breadcrumb-style category */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Wedding Plan
              </p>
              {/* weddingName — primary title */}
              <h1 className="font-heading text-[32px] sm:text-[36px] font-semibold leading-tight text-primary">
                {wedding.weddingName ?? wedding.venueName ?? 'Wedding Plan'}
              </h1>

              {/* Date + venue strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {effectiveDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    {formatDateIN(effectiveDate)}
                  </span>
                )}
                {(wedding.venueName || wedding.venueCity) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    {[wedding.venueName, wedding.venueCity].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>

              {/* Status + days countdown chips */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    STATUS_COLORS[wedding.status] ?? 'bg-secondary text-foreground border-transparent'
                  }`}
                >
                  {STATUS_LABELS[wedding.status] ?? wedding.status}
                </span>
                {isFuture && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-gold/20 text-primary border border-gold/40">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {days} days to go
                  </span>
                )}
              </div>
            </div>

            {/* Kebab: Edit / Cancel / Delete (keep as-is) */}
            <WeddingHeaderActions
              wedding={{
                weddingName:  wedding.weddingName ?? null,
                weddingDate:  wedding.weddingDate ?? null,
                venueName:    wedding.venueName ?? null,
                venueCity:    wedding.venueCity ?? null,
                venueAddress: wedding.venueAddress ?? null,
                budgetTotal:  wedding.budgetTotal ?? null,
              }}
              editAction={updateWeddingAction.bind(null, id)}
              cancelAction={cancelWeddingAction.bind(null, id)}
              deleteAction={deleteWeddingAction.bind(null, id)}
            />
          </div>
        </FadeUp>

        {/* 4 StatCards */}
        <StaggerList className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Budget Used"
            value={budgetSpent}
            format={(n) => formatINR(n)}
          />
          <StatCard
            label="Ceremonies"
            value={ceremonies.length}
          />
          <StatCard
            label="Guests"
            value={wedding.guestCount}
          />
          <StatCard
            label="Tasks Done"
            value={done}
            format={(n) => `${n}/${total}`}
          />
        </StaggerList>

        {/* Overall progress bar */}
        <FadeUp delay={0.15} className="mb-6">
          <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-foreground">Overall Progress</span>
              <span className="text-teal font-semibold">{taskPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${taskPct}%`, backgroundColor: 'var(--color-teal)' }}
              />
            </div>
          </div>
        </FadeUp>

        {/* Muhurat — ui/accordion pattern via native <details> styled as accordion */}
        {muhuratSuggestions.length > 0 && (
          <FadeUp delay={0.2} className="mb-6">
            <details className="group bg-surface border border-gold/20 rounded-xl shadow-sm overflow-hidden">
              <summary className="cursor-pointer list-none font-semibold text-primary flex items-center gap-2 px-5 py-4 select-none hover:bg-gold/5 transition-colors">
                <span
                  className="text-lg leading-none text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                  aria-hidden="true"
                >
                  ›
                </span>
                <Calendar className="h-4 w-4 text-gold" aria-hidden="true" />
                <span>Auspicious Dates (Muhurat)</span>
                {selectedMuhurat && (
                  <span className="ml-auto text-xs font-normal text-success bg-success/10 rounded-full px-2 py-0.5 border border-success/30">
                    Date Selected
                  </span>
                )}
              </summary>
              <div className="px-5 pb-5 space-y-2 border-t border-gold/10 pt-4">
                {muhuratSuggestions.map((d) => (
                  <div
                    key={d.date}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 border transition-colors ${
                      d.selected
                        ? 'border-gold bg-gold/10'
                        : 'border-gold/20 bg-background'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${d.selected ? 'text-gold-muted' : 'text-foreground'}`}>
                        {d.muhurat}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateIN(d.date)}
                        {d.tithi ? ` · ${d.tithi}` : ''}
                      </p>
                    </div>
                    {!d.selected ? (
                      <form action={selectMuhuratAction.bind(null, id)}>
                        <input type="hidden" name="date"    value={d.date} />
                        <input type="hidden" name="muhurat" value={d.muhurat} />
                        {d.tithi && <input type="hidden" name="tithi" value={d.tithi} />}
                        <button
                          type="submit"
                          className="text-xs font-medium min-h-[44px] px-3 rounded-lg border border-gold text-primary hover:bg-gold/10 transition-colors"
                        >
                          Select
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs font-semibold text-gold-muted">✓ Selected</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </FadeUp>
        )}

        {/* Upcoming ceremonies — horizontal scroll cards */}
        {upcomingCeremonies.length > 0 && (
          <FadeUp delay={0.25} className="mb-6">
            <SectionHeader
              title="Upcoming Ceremonies"
              viewAllHref={`/weddings/${id}/ceremonies`}
              viewAllLabel="All ceremonies"
            />
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {upcomingCeremonies.map((c) => {
                const colorClass = CEREMONY_COLORS[c.type] ?? CEREMONY_COLORS['OTHER']!;
                const cdDays = daysUntil(c.date);
                return (
                  <div
                    key={c.id}
                    className="min-w-[200px] max-w-[220px] shrink-0 bg-surface border border-gold/20 rounded-xl shadow-sm p-4"
                  >
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium mb-2 ${colorClass}`}>
                      {ceremonyLabel(c)}
                    </span>
                    {c.date && (
                      <p className="text-sm font-semibold text-foreground">{formatDateIN(c.date)}</p>
                    )}
                    {c.startTime && (
                      <p className="text-xs text-muted-foreground">{c.startTime}</p>
                    )}
                    {c.venue && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.venue}</p>
                    )}
                    {cdDays !== null && cdDays > 0 && (
                      <p className="text-xs font-semibold text-primary mt-2">{cdDays} days away</p>
                    )}
                  </div>
                );
              })}
            </div>
          </FadeUp>
        )}

        {/* Ceremonies section — inline add/edit/delete (existing behaviour) */}
        <FadeUp delay={0.3} className="mb-6">
          <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-primary">All Ceremonies</h2>
              <Link
                href={`/weddings/${id}/ceremonies`}
                className="text-xs text-teal font-medium hover:text-teal-hover transition-colors"
              >
                Full timeline →
              </Link>
            </div>

            {ceremonies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ceremonies added yet.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {ceremonies.map((c) => {
                  const colorClass = CEREMONY_COLORS[c.type] ?? CEREMONY_COLORS['OTHER']!;
                  return (
                    <li
                      key={c.id}
                      className="flex items-start gap-3 rounded-lg border border-gold/20 px-4 py-3"
                    >
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${colorClass}`}>
                        {ceremonyLabel(c)}
                      </span>
                      <div className="min-w-0 flex-1">
                        {c.date && (
                          <p className="text-sm font-medium text-foreground">{formatDateIN(c.date)}</p>
                        )}
                        {c.startTime && (
                          <p className="text-xs text-muted-foreground">{c.startTime}</p>
                        )}
                        {c.venue && (
                          <p className="text-xs text-muted-foreground">{c.venue}</p>
                        )}
                      </div>
                      <details className="shrink-0">
                        <summary className="cursor-pointer list-none text-xs font-medium min-h-[44px] px-2 py-1 rounded-md border border-transparent text-muted-foreground hover:text-primary hover:border-gold/30 transition-colors">
                          Edit
                        </summary>
                        <form
                          action={updateCeremonyAction.bind(null, id, c.id)}
                          className="absolute right-2 mt-1 z-10 w-64 rounded-lg border border-gold/30 bg-surface p-3 space-y-2 shadow-lg"
                        >
                          {c.type === 'OTHER' && (
                            <div>
                              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Ceremony Name</label>
                              <input name="customTypeName" type="text" defaultValue={c.customTypeName ?? ''} placeholder="e.g. Manda" className="w-full rounded border border-gold/30 px-2 py-1 text-xs" />
                            </div>
                          )}
                          <div>
                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Date</label>
                            <input name="date" type="date" min={today} defaultValue={c.date ?? ''} className="w-full rounded border border-gold/30 px-2 py-1 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Start</label>
                            <input name="startTime" type="time" defaultValue={c.startTime ?? ''} className="w-full rounded border border-gold/30 px-2 py-1 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Venue</label>
                            <input name="venue" type="text" defaultValue={c.venue ?? ''} className="w-full rounded border border-gold/30 px-2 py-1 text-xs" />
                          </div>
                          <button type="submit" className="w-full rounded bg-primary text-white text-xs py-1.5">Save</button>
                        </form>
                      </details>
                      <form action={deleteCeremonyAction.bind(null, id, c.id)}>
                        <button
                          type="submit"
                          aria-label={`Delete ${ceremonyLabel(c)} ceremony`}
                          className="text-xs font-medium min-h-[44px] px-2 rounded-md border border-transparent text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                        >
                          Delete
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add Ceremony form */}
            <CeremonyForm action={createCeremonyAction.bind(null, id)} />
          </div>
        </FadeUp>

        {/* Recent activity */}
        <FadeUp delay={0.35} className="mb-6">
          <SectionHeader title="Recent Activity" />
          <ActivityFeed weddingId={id} limit={8} />
        </FadeUp>

        {/* Quick actions */}
        <FadeUp delay={0.4} className="mb-6">
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href={`/weddings/${id}/ceremonies`}
              className="flex items-center gap-3 bg-surface border border-gold/20 rounded-xl p-4 hover:border-gold/40 hover:shadow-sm transition-all group min-h-[44px]"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Add Ceremony</p>
                <p className="text-xs text-muted-foreground">Plan a new event</p>
              </div>
            </Link>
            <Link
              href={`/weddings/${id}/guests`}
              className="flex items-center gap-3 bg-surface border border-gold/20 rounded-xl p-4 hover:border-gold/40 hover:shadow-sm transition-all group min-h-[44px]"
            >
              <div className="h-9 w-9 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-teal" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Invite Guests</p>
                <p className="text-xs text-muted-foreground">Manage your guest list</p>
              </div>
            </Link>
            <Link
              href={`/weddings/${id}/vendors`}
              className="flex items-center gap-3 bg-surface border border-gold/20 rounded-xl p-4 hover:border-gold/40 hover:shadow-sm transition-all group min-h-[44px]"
            >
              <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                <Store className="h-4 w-4 text-gold-muted" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Browse Vendors</p>
                <p className="text-xs text-muted-foreground">Find trusted vendors</p>
              </div>
            </Link>
          </div>
        </FadeUp>

        {/* Tab nav — scrollable on mobile (ADD Ceremonies tab) */}
        <FadeUp delay={0.45}>
          <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-1 mb-6 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {tabs.map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="min-h-[44px] px-4 py-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-background transition-colors whitespace-nowrap flex flex-col items-start justify-center"
                >
                  <span className="text-sm font-medium leading-tight">{label}</span>
                  <span className="text-[11px] text-muted-foreground/80 leading-tight">{desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </FadeUp>

        <p className="text-center text-xs text-muted-foreground">
          Use the tabs above to manage every part of your wedding plan.
        </p>
      </div>
    </div>
  );
}
