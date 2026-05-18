import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, MapPin, Users, CheckSquare, ArrowLeft, Wallet } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingSummary, WeddingPlan, Ceremony, MuhuratDate } from '@smartshaadi/types';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
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

const STATUS_LABELS: Record<string, string> = {
  PLANNING:  'Planning',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING:  'bg-warning/15 text-warning',
  CONFIRMED: 'bg-success/15 text-success',
  COMPLETED: 'bg-teal/10 text-teal',
  CANCELLED: 'bg-destructive/15 text-destructive',
};

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

function formatDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

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
  WEDDING:    'bg-destructive/15 text-destructive',
  RECEPTION:  'bg-teal/10 text-teal',
  ENGAGEMENT: 'bg-primary/15 text-primary',
  OTHER:      'bg-secondary text-foreground',
};

/** Display name for a ceremony — OTHER types show the user's custom label. */
function ceremonyLabel(c: { type: string; customTypeName: string | null }): string {
  if (c.type === 'OTHER' && c.customTypeName) return c.customTypeName;
  return CEREMONY_LABELS[c.type] ?? c.type;
}

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
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const selectedMuhurat = muhuratSuggestions.find((d) => d.selected);
  const today = new Date().toISOString().slice(0, 10);

  const tabs = [
    { href: `/weddings/${id}/tasks`,     label: 'Tasks',      desc: 'Checklist & task assignments' },
    { href: `/weddings/${id}/budget`,    label: 'Budget',     desc: 'Allocate & track spend by category' },
    { href: `/weddings/${id}/expenses`,  label: 'Expenses',   desc: 'Log payments & receipts' },
    { href: `/weddings/${id}/guests`,    label: 'Guests',     desc: 'Guest list, RSVP & meal preferences' },
    { href: `/weddings/${id}/catering`,  label: 'Catering',   desc: 'Menu & headcount estimates' },
    { href: `/weddings/${id}/seating`,   label: 'Seating',    desc: 'Tables & seat assignments' },
    { href: `/weddings/${id}/timeline`,  label: 'Schedule',   desc: 'Day-of timeline & run sheet' },
    { href: `/weddings/${id}/vendors`,   label: 'Vendors',    desc: 'Assigned vendors for your wedding' },
    { href: `/weddings/${id}/moodboard`, label: 'Mood Board', desc: 'Save inspiration photos & color palette' },
    { href: `/weddings/${id}/documents`, label: 'Docs',       desc: 'Contracts, permits & invoices' },
    { href: `/weddings/${id}/registry`,  label: 'Registry',   desc: 'Gift registry & wishlist' },
    { href: `/weddings/${id}/website`,   label: 'Website',    desc: 'Public wedding microsite' },
    { href: `/weddings/${id}/members`,   label: 'Members',    desc: 'Collaborators & access' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back + Header */}
        <div className="mb-2">
          <Link
            href="/weddings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All Weddings
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-2xl text-primary">
                  {wedding.weddingName ?? wedding.venueName ?? 'Wedding Plan'}
                </h1>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    STATUS_COLORS[wedding.status] ?? 'bg-secondary text-foreground'
                  }`}
                >
                  {STATUS_LABELS[wedding.status] ?? wedding.status}
                </span>
              </div>
              {wedding.venueName && wedding.weddingName && (
                <p className="text-muted-foreground text-sm mt-0.5">{wedding.venueName}</p>
              )}
              {wedding.venueCity && (
                <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  {wedding.venueCity}
                </p>
              )}
            </div>
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
        </div>

        {/* Stat cards — staggered entrance */}
        <StaggerList className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <StatCard
            icon={<Calendar className="h-5 w-5 text-gold" />}
            label="Wedding Date"
            value={formatDate(selectedMuhurat?.date ?? wedding.weddingDate)}
            small
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-gold" />}
            label="Guests"
            value={String(wedding.guestCount)}
          />
          <StatCard
            icon={<CheckSquare className="h-5 w-5 text-gold" />}
            label="Tasks Done"
            value={`${done}/${total}`}
          />
          <StatCard
            icon={<Wallet className="h-5 w-5 text-gold" />}
            label="Budget"
            value={formatCurrency(wedding.budgetTotal)}
          />
        </StaggerList>

        {/* Task progress bar */}
        <FadeUp delay={0.15} className="mb-6">
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-foreground">Overall Progress</span>
            <span className="text-teal font-semibold">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: 'var(--color-teal)' }}
            />
          </div>
        </div>
        </FadeUp>

        {/* Muhurat card */}
        {muhuratSuggestions.length > 0 && (
          <FadeUp delay={0.2} className="mb-6">
          <details className="group bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
            <summary className="cursor-pointer list-none font-semibold text-primary flex items-center gap-2">
              <span className="text-base leading-none text-muted-foreground group-open:rotate-90 transition-transform">›</span>
              <span>Auspicious Dates</span>
              {selectedMuhurat && (
                <span className="text-xs font-normal text-success bg-success/10 rounded-full px-2 py-0.5 border border-success/30">
                  Selected
                </span>
              )}
            </summary>
            <div className="space-y-2 mt-3">
              {muhuratSuggestions.map((d) => (
                <div
                  key={d.date}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 border transition-colors ${
                    d.selected
                      ? 'border-gold bg-secondary'
                      : 'border-gold/20 bg-background'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${d.selected ? 'text-gold' : 'text-foreground'}`}>
                      {d.muhurat}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(d.date)}
                      {d.tithi ? ` · ${d.tithi}` : ''}
                    </p>
                  </div>
                  {!d.selected && (
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
                  )}
                  {d.selected && (
                    <span className="text-xs font-semibold text-gold">Selected</span>
                  )}
                </div>
              ))}
            </div>
          </details>
          </FadeUp>
        )}

        {/* Ceremonies section */}
        <FadeUp delay={0.25} className="mb-6">
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-primary mb-3">Ceremonies</h2>

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
                        <p className="text-sm font-medium text-foreground">{formatDate(c.date)}</p>
                      )}
                      {c.startTime && (
                        <p className="text-xs text-muted-foreground">{c.startTime}</p>
                      )}
                      {c.venue && (
                        <p className="text-xs text-muted-foreground">{c.venue}</p>
                      )}
                    </div>
                    <details className="shrink-0">
                      <summary className="cursor-pointer list-none text-xs font-medium min-h-[32px] px-2 py-1 rounded-md border border-transparent text-muted-foreground hover:text-primary hover:border-gold/30 transition-colors">
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
                        className="text-xs font-medium min-h-[32px] px-2 rounded-md border border-transparent text-muted-foreground hover:text-primary hover:border-gold/30 transition-colors"
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

        {/* Tab nav — scrollable on mobile */}
        <FadeUp delay={0.3}>
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

        {/* Quick-access hint */}
        <p className="text-center text-xs text-muted-foreground">
          Tabs above manage every part of your wedding plan.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  small = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`font-semibold text-foreground leading-snug ${small ? 'text-xs' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  );
}
