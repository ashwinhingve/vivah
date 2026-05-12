import type { JointScore } from '@/lib/family-mode-api';

interface Props {
  joint: JointScore;
}

function bandColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-teal';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

export function JointScoreCard({ joint }: Props) {
  const hasSignals = joint.familySignalCount > 0;

  return (
    <section className="rounded-xl border border-gold/20 bg-surface p-4 sm:p-6 shadow-card">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-heading text-primary">Family joint view</h2>
        <span className="text-xs text-gold-muted">
          {hasSignals
            ? `${joint.familySignalCount} family ${joint.familySignalCount === 1 ? 'rating' : 'ratings'}`
            : 'No family ratings yet'}
        </span>
      </header>

      {!hasSignals ? (
        <p className="text-sm text-muted-foreground">
          Ask a parent or sibling to rate this match. Their scores combine with yours to surface
          where you agree or differ.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-gold-muted uppercase tracking-wide">Joint</div>
            <div className={`text-2xl font-heading ${bandColor(joint.jointScore)}`}>
              {joint.jointScore ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gold-muted uppercase tracking-wide">Your match</div>
            <div className={`text-2xl font-heading ${bandColor(joint.userMatchScore)}`}>
              {joint.userMatchScore ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gold-muted uppercase tracking-wide">Family avg</div>
            <div className={`text-2xl font-heading ${bandColor(joint.familyAvgScore)}`}>
              {joint.familyAvgScore ?? '—'}
            </div>
          </div>
        </div>
      )}

      {joint.agreementPct !== null && (
        <p className="mt-4 text-sm text-muted-foreground">
          Agreement with you: <strong className="text-primary">{joint.agreementPct}%</strong>
        </p>
      )}
    </section>
  );
}
