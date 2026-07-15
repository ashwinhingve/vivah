import type { ReactNode } from 'react';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { formatDateIN } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { label: string; chip: string }> = {
  PLANNING: { label: 'Planning', chip: 'bg-warning/15 text-warning border-warning/30' },
  CONFIRMED: { label: 'Confirmed', chip: 'bg-teal/10 text-teal border-teal/30' },
  COMPLETED: { label: 'Completed', chip: 'bg-success/15 text-success border-success/30' },
  CANCELLED: { label: 'Cancelled', chip: 'bg-muted text-muted-foreground border-muted-foreground/20' },
};

interface Props {
  weddingName: string;
  effectiveDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  status: string;
  /** Days until the wedding/muhurat. null when no date set. */
  days: number | null;
  muhuratSelected: boolean;
  /** Planning-readiness percentage (0–100). */
  readinessPct: number;
  /** Edit / cancel / delete cluster, rendered top-right. */
  actions?: ReactNode;
}

/**
 * Invitation-style hero — the dashboard's signature. A gold-framed ceremonial
 * band leading with the couple's name, date and a countdown to the muhurat,
 * paired with a readiness ring.
 */
export function WeddingHero({
  weddingName,
  effectiveDate,
  venueName,
  venueCity,
  status,
  days,
  muhuratSelected,
  readinessPct,
  actions,
}: Props) {
  const s = STATUS[status] ?? { label: status, chip: 'bg-secondary text-foreground border-transparent' };
  const venue = [venueName, venueCity].filter(Boolean).join(', ');

  const countdown =
    days === null
      ? null
      : days > 1
        ? { big: String(days), small: muhuratSelected ? 'days to the muhurat' : 'days to go' }
        : days === 1
          ? { big: '1', small: 'day to go' }
          : days === 0
            ? { big: 'Today', small: 'the big day' }
            : { big: 'Married', small: 'congratulations' };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-surface via-surface to-gold/5 shadow-gold-glow">
      {/* soft ceremonial motif */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gold/10 blur-3xl"
        aria-hidden="true"
      />
      {/* inner invitation hairline */}
      <div className="pointer-events-none absolute inset-3 rounded-xl border border-gold/20" aria-hidden="true" />

      <div className="relative p-5 sm:p-7 lg:p-8">
        {/* status + actions */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <span
            className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', s.chip)}
          >
            {s.label}
          </span>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          {/* name / date / venue */}
          <div className="min-w-0">
            <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.2em] text-gold-muted">
              The wedding of
            </p>
            <h1 className="font-heading text-3xl font-semibold leading-tight text-primary sm:text-4xl">
              {weddingName}
            </h1>

            {effectiveDate && (
              <div className="mt-3 flex items-center gap-3">
                <span className="h-px w-8 bg-gold/50" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-gold" aria-hidden="true" />
                  {formatDateIN(effectiveDate)}
                  {muhuratSelected && <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />}
                </span>
              </div>
            )}
            {venue && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-gold" aria-hidden="true" />
                {venue}
              </p>
            )}
          </div>

          {/* countdown + readiness */}
          <div className="flex items-center gap-5 lg:justify-end">
            {countdown && (
              <div className="text-center lg:text-right">
                <p className="font-heading text-4xl font-bold leading-none text-primary sm:text-5xl">
                  {countdown.big}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {countdown.small}
                </p>
              </div>
            )}
            <ReadinessRing pct={readinessPct} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Pure-SVG readiness ring (server component). */
function ReadinessRing({ pct }: { pct: number }) {
  const size = 76;
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * c;
  const color = clamped >= 75 ? 'var(--success)' : clamped >= 40 ? 'var(--teal)' : 'var(--gold)';

  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Planning readiness: ${clamped}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - dash}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-lg font-bold leading-none" style={{ color }}>
          {clamped}%
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">ready</span>
      </div>
    </div>
  );
}
