// Server component — renders the tier ladder with what's unlocked vs missing.
import type { ReactNode } from 'react';

type KycLevel = 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ELITE';

interface LevelGap {
  level:    KycLevel;
  unlocked: boolean;
  missing:  string[];
  features: string[];
}

interface Props {
  current: KycLevel;
  levels:  LevelGap[];
}

const LABEL: Record<KycLevel, string> = {
  NONE: 'Not verified', BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium', ELITE: 'Elite',
};

const ICON: Record<KycLevel, ReactNode> = {
  NONE:     null,
  BASIC:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  STANDARD: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  PREMIUM:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2"/></svg>,
  ELITE:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M9 14l-2 8 5-3 5 3-2-8"/></svg>,
};

export function LevelTierCards({ current, levels }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Verification level</h3>
        <span className="text-xs font-semibold uppercase tracking-wider text-teal">
          Currently {LABEL[current]}
        </span>
      </div>

      <div className="space-y-2">
        {levels.map((l) => (
          <div key={l.level}
            className={`rounded-xl border p-4 transition-colors ${
              l.unlocked ? 'border-success/30 bg-success/5' : 'border-border bg-surface'
            }`}>
            <div className="flex items-start gap-3">
              <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                l.unlocked ? 'bg-success/10 text-success' : 'bg-muted/40 text-muted-foreground'
              }`}>
                {ICON[l.level]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-semibold ${l.unlocked ? 'text-success' : 'text-foreground'}`}>{LABEL[l.level]}</p>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                    l.unlocked ? 'text-success' : 'text-muted-foreground'
                  }`}>
                    {l.unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                {l.features.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {l.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="text-success">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                {!l.unlocked && l.missing.length > 0 && (
                  <div className="mt-2 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">To unlock</p>
                    <ul className="mt-1 space-y-0.5">
                      {l.missing.map((m) => (
                        <li key={m} className="text-xs text-foreground">• {m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
