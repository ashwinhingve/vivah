import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, MapPin, Users, CheckSquare, ArrowLeft, Wallet } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingSummary, WeddingPlan, Ceremony, MuhuratDate } from '@smartshaadi/types';
import {
  createCeremonyAction,
  deleteCeremonyAction,
  updateCeremonyAction,
  selectMuhuratAction,
} from './actions';

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
  HALDI:      'bg-yellow-100 text-yellow-800',
  MEHNDI:     'bg-green-100 text-green-800',
  SANGEET:    'bg-purple-100 text-purple-800',
  WEDDING:    'bg-destructive/15 text-destructive',
  RECEPTION:  'bg-teal/10 text-teal',
  ENGAGEMENT: 'bg-pink-100 text-pink-800',
  OTHER:      'bg-secondary text-foreground',
};

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

  const tabs = [
    { href: `/weddings/${id}/tasks`,     label: 'Tasks' },
    { href: `/weddings/${id}/budget`,    label: 'Budget' },
    { href: `/weddings/${id}/expenses`,  label: 'Expenses' },
    { href: `/weddings/${id}/guests`,    label: 'Guests' },
    { href: `/weddings/${id}/seating`,   label: 'Seating' },
    { href: `/weddings/${id}/timeline`,  label: 'Schedule' },
    { href: `/weddings/${id}/vendors`,   label: 'Vendors' },
    { href: `/weddings/${id}/moodboard`, label: 'Mood Board' },
    { href: `/weddings/${id}/documents`, label: 'Docs' },
    { href: `/weddings/${id}/registry`,  label: 'Registry' },
    { href: `/weddings/${id}/website`,   label: 'Website' },
    { href: `/weddings/${id}/members`,   label: 'Members' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back + Header */}
        <div className="mb-2">
          <Link
            href="/weddings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-4 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All Weddings
          </Link>
          <h1 className="font-heading text-2xl text-[#7B2D42]">
            {wedding.venueName ?? 'Wedding Plan'}
          </h1>
          {wedding.venueCity && (
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#C5A47E]" aria-hidden="true" />
              {wedding.venueCity}
            </p>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <StatCard
            icon={<Calendar className="h-5 w-5 text-[#C5A47E]" />}
            label="Wedding Date"
            value={formatDate(selectedMuhurat?.date ?? wedding.weddingDate)}
            small
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-[#C5A47E]" />}
            label="Guests"
            value={String(wedding.guestCount)}
          />
          <StatCard
            icon={<CheckSquare className="h-5 w-5 text-[#C5A47E]" />}
            label="Tasks Done"
            value={`${done}/${total}`}
          />
          <StatCard
            icon={<Wallet className="h-5 w-5 text-[#C5A47E]" />}
            label="Budget"
            value={formatCurrency(wedding.budgetTotal)}
          />
        </div>

        {/* Task progress bar */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-foreground">Overall Progress</span>
            <span className="text-[#0E7C7B] font-semibold">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#F5EFE8]">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: '#0E7C7B' }}
            />
          </div>
        </div>

        {/* Muhurat card */}
        {muhuratSuggestions.length > 0 && (
          <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-semibold text-[#0A1F4D] mb-3 flex items-center gap-2">
              <span>Auspicious Dates (Muhurat)</span>
              {selectedMuhurat && (
                <span className="text-xs font-normal text-[#059669] bg-green-50 rounded-full px-2 py-0.5 border border-green-200">
                  Selected
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {muhuratSuggestions.map((d) => (
                <div
                  key={d.date}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 border transition-colors ${
                    d.selected
                      ? 'border-[#C5A47E] bg-[#FDF6EC]'
                      : 'border-[#C5A47E]/20 bg-[#FEFAF6]'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${d.selected ? 'text-[#C5A47E]' : 'text-[#0F172A]'}`}>
                      {d.muhurat}
                    </p>
                    <p className="text-xs text-[#64748B]">
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
                        className="text-xs font-medium min-h-[44px] px-3 rounded-lg border border-[#C5A47E] text-[#7B2D42] hover:bg-[#C5A47E]/10 transition-colors"
                      >
                        Select
                      </button>
                    </form>
                  )}
                  {d.selected && (
                    <span className="text-xs font-semibold text-[#C5A47E]">Selected</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ceremonies section */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-[#0A1F4D] mb-3">Ceremonies</h2>

          {ceremonies.length === 0 ? (
            <p className="text-sm text-[#64748B]">No ceremonies added yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {ceremonies.map((c) => {
                const colorClass = CEREMONY_COLORS[c.type] ?? CEREMONY_COLORS['OTHER']!;
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-3 rounded-lg border border-[#C5A47E]/20 px-4 py-3"
                  >
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${colorClass}`}>
                      {CEREMONY_LABELS[c.type] ?? c.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      {c.date && (
                        <p className="text-sm font-medium text-[#0F172A]">{formatDate(c.date)}</p>
                      )}
                      {c.startTime && (
                        <p className="text-xs text-[#64748B]">
                          {c.startTime}{c.endTime ? ` – ${c.endTime}` : ''}
                        </p>
                      )}
                      {c.venue && (
                        <p className="text-xs text-[#64748B]">{c.venue}</p>
                      )}
                    </div>
                    <details className="shrink-0">
                      <summary className="cursor-pointer list-none text-xs font-medium min-h-[32px] px-2 py-1 rounded-md border border-transparent text-[#64748B] hover:text-[#7B2D42] hover:border-[#C5A47E]/30 transition-colors">
                        Edit
                      </summary>
                      <form
                        action={updateCeremonyAction.bind(null, id, c.id)}
                        className="absolute right-2 mt-1 z-10 w-64 rounded-lg border border-[#C5A47E]/30 bg-surface p-3 space-y-2 shadow-lg"
                      >
                        <div>
                          <label className="block text-[10px] font-medium text-[#64748B] mb-1">Date</label>
                          <input name="date" type="date" defaultValue={c.date ?? ''} className="w-full rounded border border-[#C5A47E]/30 px-2 py-1 text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-[#64748B] mb-1">Start</label>
                            <input name="startTime" type="time" defaultValue={c.startTime ?? ''} className="w-full rounded border border-[#C5A47E]/30 px-2 py-1 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[#64748B] mb-1">End</label>
                            <input name="endTime" type="time" defaultValue={c.endTime ?? ''} className="w-full rounded border border-[#C5A47E]/30 px-2 py-1 text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[#64748B] mb-1">Venue</label>
                          <input name="venue" type="text" defaultValue={c.venue ?? ''} className="w-full rounded border border-[#C5A47E]/30 px-2 py-1 text-xs" />
                        </div>
                        <button type="submit" className="w-full rounded bg-[#7B2D42] text-white text-xs py-1.5">Save</button>
                      </form>
                    </details>
                    <form action={deleteCeremonyAction.bind(null, id, c.id)}>
                      <button
                        type="submit"
                        aria-label={`Delete ${CEREMONY_LABELS[c.type] ?? c.type} ceremony`}
                        className="text-xs font-medium min-h-[32px] px-2 rounded-md border border-transparent text-[#64748B] hover:text-[#7B2D42] hover:border-[#C5A47E]/30 transition-colors"
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
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-[#7B2D42] hover:text-[#5f2233] min-h-[44px]">
              <span className="text-lg leading-none group-open:rotate-45 transition-transform">+</span>
              Add Ceremony
            </summary>
            <form
              action={createCeremonyAction.bind(null, id)}
              className="mt-3 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Type</label>
                  <select
                    name="type"
                    required
                    className="w-full rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2D42]/20"
                  >
                    {Object.entries(CEREMONY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    className="w-full rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2D42]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    className="w-full rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2D42]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">End Time</label>
                  <input
                    type="time"
                    name="endTime"
                    className="w-full rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2D42]/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Venue</label>
                <input
                  type="text"
                  name="venue"
                  placeholder="e.g. The Rooftop Garden"
                  className="w-full rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2D42]/20"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-lg bg-[#7B2D42] text-white text-sm font-semibold hover:bg-[#5f2233] transition-colors"
              >
                Add Ceremony
              </button>
            </form>
          </details>
        </div>

        {/* Tab nav — scrollable on mobile */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-1 mb-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-center min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-[#7B2D42] hover:bg-[#FEFAF6] transition-colors whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

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
    <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 flex flex-col gap-2">
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
