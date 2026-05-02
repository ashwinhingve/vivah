// Server component — top-of-page stats strip for the KYC admin dashboard.
interface Stats {
  pending:        number;
  verified:       number;
  rejected:       number;
  infoRequested:  number;
  pendingAppeals: number;
  duplicates:     number;
  sanctions:      number;
}

const TILES: { key: keyof Stats; label: string; tone: 'teal' | 'warning' | 'destructive' | 'muted' }[] = [
  { key: 'pending',        label: 'Pending review',  tone: 'warning' },
  { key: 'pendingAppeals', label: 'Pending appeals', tone: 'warning' },
  { key: 'infoRequested',  label: 'Info requested',  tone: 'muted' },
  { key: 'duplicates',     label: 'Duplicate flags', tone: 'destructive' },
  { key: 'sanctions',      label: 'Sanctions hits',  tone: 'destructive' },
  { key: 'verified',       label: 'Verified',        tone: 'teal' },
  { key: 'rejected',       label: 'Rejected',        tone: 'muted' },
];

export function KycStatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {TILES.map((t) => {
        const cls =
          t.tone === 'teal'        ? 'text-teal' :
          t.tone === 'warning'     ? 'text-warning' :
          t.tone === 'destructive' ? 'text-destructive' :
                                     'text-muted-foreground';
        return (
          <div key={t.key} className="rounded-xl border border-gold/40 bg-surface p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className={`text-2xl font-bold font-heading mt-1 ${cls}`}>{stats[t.key] ?? 0}</p>
          </div>
        );
      })}
    </div>
  );
}
