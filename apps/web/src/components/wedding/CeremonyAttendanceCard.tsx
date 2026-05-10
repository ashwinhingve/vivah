import Link from 'next/link';
import type {
  FaqCeremonyResult,
  FaqCeremonyType,
  FaqConfidenceBand,
  FaqWeddingSummaryItem,
} from '@smartshaadi/types';

const CEREMONY_LABEL: Record<FaqCeremonyType, string> = {
  sangeet: 'Sangeet',
  mehndi: 'Mehndi',
  wedding: 'Wedding Ceremony',
  reception: 'Reception',
};

// Bands are direction-aware: "high" means confident in attendance OR confident
// in absence; "medium" means leaning; "low" is the central uncertain region.
// Per-guest direction (attend/skip/uncertain) is surfaced on the guest detail
// view; this summary aggregates only by confidence.
const BAND_LABEL: Record<FaqConfidenceBand, string> = {
  high: 'definite (attend or skip)',
  medium: 'leaning',
  low: 'uncertain',
};

const BAND_BAR_CLASS: Record<FaqConfidenceBand, string> = {
  high: 'bg-success',
  medium: 'bg-gold',
  low: 'bg-muted-foreground/60',
};

const BAND_TEXT_CLASS: Record<FaqConfidenceBand, string> = {
  high: 'text-success',
  medium: 'text-gold',
  low: 'text-muted-foreground',
};

interface DetailedProps {
  weddingId: string;
  ceremonyResult: FaqCeremonyResult;
  summaryItem?: never;
}

interface SummaryProps {
  weddingId: string;
  summaryItem: FaqWeddingSummaryItem;
  ceremonyResult?: never;
}

type Props = DetailedProps | SummaryProps;

export function CeremonyAttendanceCard(props: Props) {
  const { weddingId } = props;
  const isDetailed = props.ceremonyResult !== undefined;

  const ceremonyId = isDetailed
    ? props.ceremonyResult.ceremony_id
    : props.summaryItem.ceremony_id;
  const ceremonyType = isDetailed
    ? props.ceremonyResult.ceremony_type
    : props.summaryItem.ceremony_type;
  const totalInvited = isDetailed
    ? props.ceremonyResult.total_invited
    : props.summaryItem.total_invited;
  const expectedAttendance = isDetailed
    ? props.ceremonyResult.summary.expected_attendance
    : props.summaryItem.expected_attendance;
  const cateringCount = isDetailed
    ? Math.ceil(props.ceremonyResult.summary.expected_attendance * 1.1)
    : props.summaryItem.estimated_catering_count;

  return (
    <article className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5 mb-4">
      <header className="mb-4">
        <h2 className="font-heading text-primary text-xl">
          {CEREMONY_LABEL[ceremonyType] ?? ceremonyType}
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums mt-1">
          {totalInvited} invited
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat
          label="Expected attendees"
          value={`~${Math.round(expectedAttendance)}`}
          accent="text-teal"
        />
        <Stat
          label={
            <>
              Catering count<sup>*</sup>
            </>
          }
          value={`~${cateringCount}`}
          accent="text-primary"
        />
      </div>

      {isDetailed ? (
        <div className="space-y-2 mb-3">
          <ConfidenceBar
            count={props.ceremonyResult.summary.high_confidence_count}
            total={totalInvited}
            band="high"
          />
          <ConfidenceBar
            count={props.ceremonyResult.summary.medium_confidence_count}
            total={totalInvited}
            band="medium"
          />
          <ConfidenceBar
            count={props.ceremonyResult.summary.low_confidence_count}
            total={totalInvited}
            band="low"
          />
        </div>
      ) : null}

      <Link
        href={`/weddings/${weddingId}/catering/${ceremonyId}`}
        className="text-sm text-teal hover:text-primary transition-colors inline-flex items-center gap-1 min-h-[44px]"
      >
        View guest details →
      </Link>
    </article>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: React.ReactNode;
  value: string;
  accent: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function ConfidenceBar({
  count,
  total,
  band,
}: {
  count: number;
  total: number;
  band: FaqConfidenceBand;
}) {
  const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gold/15 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${BAND_BAR_CLASS[band]}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <p className={`text-xs tabular-nums whitespace-nowrap ${BAND_TEXT_CLASS[band]}`}>
        <span className="font-semibold">{count}</span> {BAND_LABEL[band]}
      </p>
    </div>
  );
}
