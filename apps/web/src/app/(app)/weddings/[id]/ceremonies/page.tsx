/**
 * /weddings/[id]/ceremonies — Vertical timeline of all ceremonies.
 * Server Component. Mutations via existing Server Actions in [id]/actions.ts.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Clock, CheckCircle2, Circle } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { formatDateIN, daysUntil } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { CeremonyForm } from '../CeremonyForm.client';
import {
  createCeremonyAction,
  deleteCeremonyAction,
  updateCeremonyAction,
} from '../actions';
import type { WeddingSummary, Ceremony } from '@smartshaadi/types';
import { cn } from '@/lib/utils';

// ── constants ─────────────────────────────────────────────────────────────────

const CEREMONY_LABELS: Record<string, string> = {
  HALDI:      'Haldi',
  MEHNDI:     'Mehndi',
  SANGEET:    'Sangeet',
  WEDDING:    'Wedding',
  RECEPTION:  'Reception',
  ENGAGEMENT: 'Engagement',
  OTHER:      'Other',
};

const CEREMONY_COLORS: Record<string, { badge: string; dot: string }> = {
  HALDI:      { badge: 'bg-warning/15 text-warning border-warning/30',      dot: 'bg-warning' },
  MEHNDI:     { badge: 'bg-success/15 text-success border-success/30',      dot: 'bg-success' },
  SANGEET:    { badge: 'bg-primary/15 text-primary border-primary/30',      dot: 'bg-primary' },
  WEDDING:    { badge: 'bg-primary/20 text-primary border-primary/40',      dot: 'bg-primary' },
  RECEPTION:  { badge: 'bg-teal/10 text-teal border-teal/30',               dot: 'bg-teal' },
  ENGAGEMENT: { badge: 'bg-teal/15 text-teal border-teal/30',               dot: 'bg-teal' },
  OTHER:      { badge: 'bg-secondary text-foreground border-gold/20',       dot: 'bg-gold' },
};

function ceremonyLabel(c: { type: string; customTypeName: string | null }): string {
  if (c.type === 'OTHER' && c.customTypeName) return c.customTypeName;
  return CEREMONY_LABELS[c.type] ?? c.type;
}

// ── data fetchers ─────────────────────────────────────────────────────────────

async function fetchWeddingName(id: string): Promise<string> {
  const detail = await fetchAuth<WeddingSummary>(`/api/v1/weddings/${id}`);
  return detail?.weddingName ?? detail?.venueName ?? 'Wedding';
}

async function fetchCeremonies(id: string): Promise<Ceremony[]> {
  const data = await fetchAuth<{ ceremonies: Ceremony[] }>(`/api/v1/weddings/${id}/ceremonies`);
  return data?.ceremonies ?? [];
}

// ── page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CeremoniesPage({ params }: PageProps) {
  const { id } = await params;

  const [weddingName, ceremonies] = await Promise.all([
    fetchWeddingName(id),
    fetchCeremonies(id),
  ]);

  if (!weddingName && !ceremonies) notFound();

  const today = new Date().toISOString().slice(0, 10);

  // Sort by date ascending (undated go last)
  const sorted = [...ceremonies].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const isPast = (c: Ceremony) =>
    c.status === 'COMPLETED' || (c.date !== null && c.date < today);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <PageHeader
          title="Ceremonies"
          subtitle={`${weddingName} · Plan and track every ceremony event`}
          breadcrumbs={[
            { label: 'My Weddings', href: '/weddings' },
            { label: weddingName, href: `/weddings/${id}` },
            { label: 'Ceremonies' },
          ]}
        />

        {/* Add Ceremony CTA inline */}
        <FadeUp delay={0} className="mb-8">
          <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-primary mb-3 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 inline-flex items-center justify-center text-primary text-xs font-bold">+</span>
              Add New Ceremony
            </h2>
            <CeremonyForm action={createCeremonyAction.bind(null, id)} />
          </div>
        </FadeUp>

        {/* Empty state */}
        {ceremonies.length === 0 && (
          <div className="bg-surface border border-gold/20 rounded-xl shadow-card">
            <EmptyState
              variant="no-tasks"
              title="No ceremonies yet"
              description="Add your first ceremony above — Haldi, Mehndi, Sangeet, Wedding, or a custom name."
            />
          </div>
        )}

        {/* Vertical timeline */}
        {ceremonies.length > 0 && (
          <StaggerList className="relative">
            {/* Timeline vertical line */}
            <div
              className="absolute left-5 top-0 bottom-0 w-px bg-gold/20"
              aria-hidden="true"
            />

            <div className="space-y-6 pl-14">
              {sorted.map((c) => {
                const past = isPast(c);
                const days = daysUntil(c.date);
                const isFuture = days !== null && days > 0;
                const colors = CEREMONY_COLORS[c.type] ?? CEREMONY_COLORS['OTHER']!;

                return (
                  <div key={c.id} className="relative">
                    {/* Timeline dot — gold circle */}
                    <div
                      className={cn(
                        'absolute -left-[36px] top-4 h-5 w-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center',
                        past ? 'bg-success/80' : 'bg-gold'
                      )}
                      aria-hidden="true"
                    >
                      {past ? (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      ) : (
                        <Circle className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>

                    {/* Ceremony card */}
                    <div
                      className={cn(
                        'bg-surface border rounded-xl shadow-sm p-5 transition-all',
                        past
                          ? 'border-gold/10 opacity-70'
                          : 'border-gold/20 hover:border-gold/40 hover:shadow-card-hover'
                      )}
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-heading text-lg font-semibold text-primary leading-tight">
                            {ceremonyLabel(c)}
                          </h3>
                          <span className={cn(
                            'text-xs font-medium px-2.5 py-0.5 rounded-full border',
                            colors.badge
                          )}>
                            {CEREMONY_LABELS[c.type] ?? c.type}
                          </span>
                          {past && (
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
                              Completed
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/15 text-primary border border-gold/30">
                              {days}d away
                            </span>
                          )}
                        </div>

                        {/* Edit / Delete kebab */}
                        <div className="flex items-center gap-1 shrink-0">
                          <details className="relative">
                            <summary className="cursor-pointer list-none text-xs font-medium min-h-[44px] px-2 py-1 rounded-md border border-transparent text-muted-foreground hover:text-primary hover:border-gold/30 transition-colors">
                              Edit
                            </summary>
                            <form
                              action={updateCeremonyAction.bind(null, id, c.id)}
                              className="absolute right-0 mt-1 z-20 w-64 rounded-lg border border-gold/30 bg-surface p-3 space-y-2 shadow-xl"
                            >
                              {c.type === 'OTHER' && (
                                <div>
                                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">Ceremony Name</label>
                                  <input
                                    name="customTypeName"
                                    type="text"
                                    defaultValue={c.customTypeName ?? ''}
                                    placeholder="e.g. Manda"
                                    className="w-full rounded border border-gold/30 px-2 py-1 text-xs bg-background"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="block text-[10px] font-medium text-muted-foreground mb-1">Date</label>
                                <input
                                  name="date"
                                  type="date"
                                  defaultValue={c.date ?? ''}
                                  className="w-full rounded border border-gold/30 px-2 py-1 text-xs bg-background"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-muted-foreground mb-1">Start Time</label>
                                <input
                                  name="startTime"
                                  type="time"
                                  defaultValue={c.startTime ?? ''}
                                  className="w-full rounded border border-gold/30 px-2 py-1 text-xs bg-background"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-muted-foreground mb-1">Venue</label>
                                <input
                                  name="venue"
                                  type="text"
                                  defaultValue={c.venue ?? ''}
                                  className="w-full rounded border border-gold/30 px-2 py-1 text-xs bg-background"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-muted-foreground mb-1">Notes</label>
                                <input
                                  name="notes"
                                  type="text"
                                  defaultValue={c.notes ?? ''}
                                  className="w-full rounded border border-gold/30 px-2 py-1 text-xs bg-background"
                                />
                              </div>
                              <button
                                type="submit"
                                className="w-full rounded-lg bg-primary text-white text-xs font-semibold py-2 min-h-[36px] hover:bg-primary-hover transition-colors"
                              >
                                Save Changes
                              </button>
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
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                        {c.date && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
                            {formatDateIN(c.date)}
                          </span>
                        )}
                        {c.startTime && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
                            {c.startTime}
                          </span>
                        )}
                        {c.venue && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
                            <span className="truncate max-w-[200px]">{c.venue}</span>
                          </span>
                        )}
                        {c.expectedGuests != null && (
                          <span className="flex items-center gap-1">
                            <span className="text-gold font-semibold text-xs">~{c.expectedGuests}</span>
                            <span className="text-xs">guests expected</span>
                          </span>
                        )}
                      </div>

                      {/* Dress code */}
                      {c.dressCode && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Dress code:</span> {c.dressCode}
                        </p>
                      )}

                      {/* Notes */}
                      {c.notes && (
                        <p className="mt-2 text-xs text-muted-foreground italic border-t border-gold/10 pt-2">
                          {c.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </StaggerList>
        )}

        {/* Back to overview */}
        <div className="mt-10 text-center">
          <Link
            href={`/weddings/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
