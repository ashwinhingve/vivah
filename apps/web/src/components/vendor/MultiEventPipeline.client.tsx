'use client';

import { useMemo, useState } from 'react';
import { Calendar, Users, MapPin } from 'lucide-react';

interface PipelineBooking {
  id: string;
  eventDate: string;
  ceremonyType: string;
  status: string;
  totalAmount: string;
  guestCount: number | null;
  eventLocation: string | null;
}

interface UtilizationStats {
  total_12m: number;
  by_type: {
    WEDDING: number;
    CORPORATE: number;
    FESTIVAL: number;
    COMMUNITY_EVENT: number;
    OTHER: number;
  };
  diversity_score: number;
  off_season_pct: number;
}

export interface MultiEventPipelineData {
  vendor: { id: string; businessName: string };
  upcoming: PipelineBooking[];
  utilization: UtilizationStats;
}

const TABS = [
  { key: 'ALL',             label: 'All' },
  { key: 'WEDDING',         label: 'Weddings' },
  { key: 'CORPORATE',       label: 'Corporate' },
  { key: 'FESTIVAL',        label: 'Festival' },
  { key: 'COMMUNITY_EVENT', label: 'Community' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const WEDDING_CEREMONIES = new Set(['WEDDING', 'HALDI', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'RECEPTION']);

function bucket(ceremonyType: string): Exclude<TabKey, 'ALL'> | 'OTHER' {
  if (WEDDING_CEREMONIES.has(ceremonyType)) return 'WEDDING';
  if (ceremonyType === 'CORPORATE') return 'CORPORATE';
  if (ceremonyType === 'FESTIVAL') return 'FESTIVAL';
  if (ceremonyType === 'COMMUNITY_EVENT' || ceremonyType === 'COMMUNITY') return 'COMMUNITY_EVENT';
  return 'OTHER';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'CONFIRMED' ? 'bg-success/15 text-success border-success/30' :
    status === 'PENDING'   ? 'bg-warning/15 text-warning border-warning/30' :
    'bg-muted text-muted-foreground border-gold/20';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>
      {status.toLowerCase()}
    </span>
  );
}

export function MultiEventPipeline({ data }: { data: MultiEventPipelineData }) {
  const [tab, setTab] = useState<TabKey>('ALL');

  const filtered = useMemo(() => {
    if (tab === 'ALL') return data.upcoming;
    return data.upcoming.filter(b => bucket(b.ceremonyType) === tab);
  }, [data.upcoming, tab]);

  const { utilization } = data;
  const maxCount = Math.max(
    utilization.by_type.WEDDING,
    utilization.by_type.CORPORATE,
    utilization.by_type.FESTIVAL,
    utilization.by_type.COMMUNITY_EVENT,
    1,
  );

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-gold/20 rounded-xl shadow-card p-4 sm:p-6">
        <h2 className="text-base font-heading text-primary mb-3">
          12-month utilization
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {utilization.total_12m} total bookings · diversity {(utilization.diversity_score * 100).toFixed(0)}/100
          {' · '}off-season {utilization.off_season_pct}%
        </p>
        <ul className="space-y-2">
          {(['WEDDING', 'CORPORATE', 'FESTIVAL', 'COMMUNITY_EVENT'] as const).map(type => {
            const count = utilization.by_type[type];
            const width = `${(count / maxCount) * 100}%`;
            return (
              <li key={type} className="flex items-center gap-3">
                <span className="w-24 text-xs uppercase tracking-wide text-muted-foreground">
                  {type.replace('_', ' ')}
                </span>
                <div className="flex-1 h-2 rounded-full bg-gold/10 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width }} />
                </div>
                <span className="w-8 text-right text-sm font-medium">{count}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap gap-2 mb-3">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? 'px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-white'
                  : 'px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-gold/20 text-foreground hover:bg-gold/5'
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-gold/30 rounded-xl px-4 py-8 text-center">
            No upcoming bookings in this category yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(b => (
              <li
                key={b.id}
                className="bg-surface border border-gold/20 rounded-xl shadow-card px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <span className="inline-flex items-center gap-1 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-teal" aria-hidden="true" />
                  {formatDate(b.eventDate)}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {b.ceremonyType.replace('_', ' ')}
                </span>
                <StatusBadge status={b.status} />
                {b.guestCount ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {b.guestCount}
                  </span>
                ) : null}
                {b.eventLocation ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {b.eventLocation}
                  </span>
                ) : null}
                <span className="ml-auto text-sm font-medium text-primary">
                  ₹{Number(b.totalAmount).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
