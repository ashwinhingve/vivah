'use client';

import { useMemo, useState } from 'react';
import type {
  GunaResult,
  GunaFactorDetail,
  DoshaSummary,
  DomainBand,
  DoshaSeverity,
  Remedy,
} from '@smartshaadi/types';

interface AshtakootFactor {
  name: string;
  nameHindi: string;
  scored: number;
  max: number;
}

interface CompatibilityDisplayProps {
  /** Legacy: total Guna score 0–36. Used when `result` is absent. */
  gunaScore?: number;
  /** Legacy: factor breakdown without metadata. */
  factors?: AshtakootFactor[];
  /** Full advanced GunaResult — unlocks multi-tab UI when present. */
  result?: GunaResult | null;
  isLoading?: boolean;
}

type TabKey = 'overview' | 'doshas' | 'factors' | 'insights' | 'remedies';

const DEFAULT_FACTORS: AshtakootFactor[] = [
  { name: 'Varna',        nameHindi: 'वर्ण',       scored: 0, max: 1 },
  { name: 'Vashya',       nameHindi: 'वश्य',       scored: 0, max: 2 },
  { name: 'Tara',         nameHindi: 'तारा',       scored: 0, max: 3 },
  { name: 'Yoni',         nameHindi: 'योनि',       scored: 0, max: 4 },
  { name: 'Graha Maitri', nameHindi: 'ग्रह मैत्री',  scored: 0, max: 5 },
  { name: 'Gana',         nameHindi: 'गण',         scored: 0, max: 6 },
  { name: 'Bhakoot',      nameHindi: 'भकूट',       scored: 0, max: 7 },
  { name: 'Nadi',         nameHindi: 'नाड़ी',       scored: 0, max: 8 },
];

function getScoreConfig(score: number): { color: string; label: string } {
  if (score <= 17) return { color: '#DC2626', label: 'Low Compatibility' };
  if (score <= 24) return { color: '#D97706', label: 'Moderate' };
  if (score <= 32) return { color: '#0E7C7B', label: 'Good Compatibility' };
  return { color: '#059669', label: 'Excellent Match' };
}

const SEVERITY_COLOR: Record<DoshaSeverity, string> = {
  none:   '#059669',
  low:    '#D97706',
  medium: '#EA580C',
  high:   '#DC2626',
};

const BAND_COLOR: Record<DomainBand, string> = {
  excellent: '#059669',
  good:      '#0E7C7B',
  average:   '#D97706',
  low:       '#DC2626',
};

const DOMAIN_META: Record<keyof GunaResult['insights'], { label: string; hi: string; icon: string }> = {
  mental:     { label: 'Mental Harmony',   hi: 'मानसिक',   icon: '🧠' },
  physical:   { label: 'Health & Body',    hi: 'शारीरिक',  icon: '💪' },
  prosperity: { label: 'Prosperity',       hi: 'समृद्धि',   icon: '💎' },
  progeny:    { label: 'Progeny & Family', hi: 'संतान',    icon: '👶' },
  longevity:  { label: 'Longevity',        hi: 'दीर्घायु',  icon: '🪔' },
};

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function CompatibilityDisplay({
  gunaScore,
  factors,
  result,
  isLoading = false,
}: CompatibilityDisplayProps) {
  const totalScore = result?.totalScore ?? gunaScore ?? 0;
  const { color, label } = getScoreConfig(totalScore);
  const progress = Math.min(totalScore / 36, 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const [tab, setTab] = useState<TabKey>('overview');

  const factorList: AshtakootFactor[] = useMemo(() => {
    if (result) {
      const f = result.factors;
      return [
        { name: f.varna.name,       nameHindi: f.varna.nameHi,       scored: f.varna.score,       max: f.varna.max },
        { name: f.vashya.name,      nameHindi: f.vashya.nameHi,      scored: f.vashya.score,      max: f.vashya.max },
        { name: f.tara.name,        nameHindi: f.tara.nameHi,        scored: f.tara.score,        max: f.tara.max },
        { name: f.yoni.name,        nameHindi: f.yoni.nameHi,        scored: f.yoni.score,        max: f.yoni.max },
        { name: f.grahaMaitri.name, nameHindi: f.grahaMaitri.nameHi, scored: f.grahaMaitri.score, max: f.grahaMaitri.max },
        { name: f.gana.name,        nameHindi: f.gana.nameHi,        scored: f.gana.score,        max: f.gana.max },
        { name: f.bhakoot.name,     nameHindi: f.bhakoot.nameHi,     scored: f.bhakoot.score,     max: f.bhakoot.max },
        { name: f.nadi.name,        nameHindi: f.nadi.nameHi,        scored: f.nadi.score,        max: f.nadi.max },
      ];
    }
    return factors ?? DEFAULT_FACTORS;
  }, [result, factors]);

  if (isLoading) return <SkeletonCard />;

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
      {/* ── Header: ring + label + interpretation ─────────── */}
      <div className="p-5 flex items-center gap-5">
        <div className="relative shrink-0 w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="#F0EBE4" strokeWidth="8" />
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold leading-none" style={{ color }}>{totalScore}</span>
            <span className="text-xs text-muted-foreground">/36</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-xl font-semibold text-primary"
            style={{ fontFamily: '"Noto Serif Devanagari", "Playfair Display", serif' }}
          >
            गुण मिलान
          </p>
          <p className="text-sm text-muted-foreground">Ashtakoot Compatibility</p>
          <span
            className="inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: `${color}18`, color }}
          >
            {result?.interpretation ?? label}
          </span>
          {result?.blockingDosha && (
            <span className="ml-2 inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border border-destructive/30 text-destructive bg-destructive/5">
              ⚠ Dosha alert
            </span>
          )}
        </div>
      </div>

      {/* ── Tab strip (only when we have a full result) ───── */}
      {result ? (
        <>
          <div className="flex border-t border-border-light overflow-x-auto scrollbar-hide">
            {(['overview', 'doshas', 'factors', 'insights', 'remedies'] as TabKey[]).map((k) => {
              const isActive = tab === k;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex-1 min-w-[5.5rem] text-xs font-medium py-2.5 transition-colors ${
                    isActive
                      ? 'text-teal border-b-2 border-teal bg-teal/5'
                      : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
                  }`}
                >
                  {tabLabel(k)}
                </button>
              );
            })}
          </div>
          <div className="p-5 border-t border-border-light">
            {tab === 'overview'  && <OverviewPane result={result} />}
            {tab === 'doshas'    && <DoshasPane doshas={result.doshas} />}
            {tab === 'factors'   && <FactorsPane factors={result.factors} color={color} />}
            {tab === 'insights'  && <InsightsPane insights={result.insights} yogas={result.yogas} />}
            {tab === 'remedies'  && <RemediesPane remedies={result.remedies} />}
          </div>
        </>
      ) : (
        <CollapsibleFactorList factors={factorList} color={color} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Sub-views
// ──────────────────────────────────────────────────────────────────

function tabLabel(k: TabKey): string {
  switch (k) {
    case 'overview':  return 'Overview';
    case 'doshas':    return 'Doshas';
    case 'factors':   return 'Factors';
    case 'insights':  return 'Insights';
    case 'remedies':  return 'Remedies';
  }
}

function OverviewPane({ result }: { result: GunaResult }) {
  const counts = useMemo(() => {
    const d = result.doshas;
    let active = 0, cancelled = 0;
    [d.manglik, d.nadi, d.bhakoot, d.gana].forEach((x) => {
      const isDosha = 'dosha' in x ? x.dosha : x.conflict;
      if (isDosha) {
        if (x.cancelled) cancelled++;
        else active++;
      }
    });
    if (d.rajju.dosha) active++;
    if (d.vedha.dosha) active++;
    return { active, cancelled };
  }, [result.doshas]);

  const yogaCount =
    (result.yogas.mahendra.present ? 1 : 0) +
    (result.yogas.streeDeergha.present ? 1 : 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground leading-relaxed">{result.recommendation}</p>

      <div className="grid grid-cols-3 gap-2">
        <StatChip label="Score"          value={`${result.totalScore}/36`} accent="#0E7C7B" />
        <StatChip label="Active doshas"  value={String(counts.active)}     accent={counts.active > 0 ? '#DC2626' : '#059669'} />
        <StatChip label="Yogas present"  value={String(yogaCount)}         accent="#0A1F4D" />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Life-Domain Snapshot
        </p>
        <div className="space-y-1.5">
          {(Object.keys(result.insights) as (keyof GunaResult['insights'])[]).map((key) => {
            const ins = result.insights[key];
            const meta = DOMAIN_META[key];
            const c = BAND_COLOR[ins.label];
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0">
                  <span className="mr-1">{meta.icon}</span>{meta.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-border-light overflow-hidden">
                  <div className="h-full rounded-full"
                       style={{ width: `${ins.score}%`, background: c, transition: 'width 0.4s ease-out' }} />
                </div>
                <span className="shrink-0 w-9 text-right tabular-nums" style={{ color: c }}>
                  {Math.round(ins.score)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border-light bg-background/40 px-3 py-2.5 text-center">
      <div className="text-base font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function DoshasPane({ doshas }: { doshas: DoshaSummary }) {
  const items: Array<{
    key: string;
    name: string;
    isActive: boolean;
    cancelled: boolean;
    severity: DoshaSeverity;
    detail?: string | null;
    reason: string;
  }> = [
    { key: 'manglik', name: 'Mangal Dosha',  isActive: doshas.manglik.conflict, cancelled: doshas.manglik.cancelled, severity: doshas.manglik.severity, detail: `${doshas.manglik.boyStatus} / ${doshas.manglik.girlStatus}`, reason: doshas.manglik.reason },
    { key: 'nadi',    name: 'Nadi Dosha',    isActive: doshas.nadi.dosha,       cancelled: doshas.nadi.cancelled,    severity: doshas.nadi.severity, detail: doshas.nadi.boyNadi && doshas.nadi.girlNadi ? `${doshas.nadi.boyNadi} / ${doshas.nadi.girlNadi}` : null, reason: doshas.nadi.reason },
    { key: 'bhakoot', name: 'Bhakoot Dosha', isActive: doshas.bhakoot.dosha,    cancelled: doshas.bhakoot.cancelled, severity: doshas.bhakoot.severity, detail: doshas.bhakoot.axis ?? null, reason: doshas.bhakoot.reason },
    { key: 'rajju',   name: 'Rajju Dosha',   isActive: doshas.rajju.dosha,      cancelled: false,                    severity: doshas.rajju.severity, detail: doshas.rajju.boyRajju && doshas.rajju.girlRajju ? `${doshas.rajju.boyRajju} / ${doshas.rajju.girlRajju}` : null, reason: doshas.rajju.reason },
    { key: 'vedha',   name: 'Vedha Dosha',   isActive: doshas.vedha.dosha,      cancelled: false,                    severity: doshas.vedha.severity, detail: null,                                                                                                    reason: doshas.vedha.reason },
    { key: 'gana',    name: 'Gana Dosha',    isActive: doshas.gana.dosha,       cancelled: doshas.gana.cancelled,    severity: doshas.gana.severity, detail: doshas.gana.boyGana && doshas.gana.girlGana ? `${doshas.gana.boyGana} / ${doshas.gana.girlGana}` : null, reason: doshas.gana.reason },
  ];

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const accent = item.isActive
          ? (item.cancelled ? SEVERITY_COLOR.low : SEVERITY_COLOR[item.severity])
          : SEVERITY_COLOR.none;
        const status = !item.isActive
          ? 'Clear'
          : item.cancelled
            ? 'Cancelled'
            : 'Active';
        return (
          <div key={item.key}
               className="rounded-lg border border-border-light bg-background/40 p-3"
               style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{item.name}</p>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: `${accent}1F`, color: accent }}>
                {status}
              </span>
            </div>
            {item.detail && (
              <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
            )}
            <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{item.reason}</p>
          </div>
        );
      })}
    </div>
  );
}

function FactorsPane({ factors, color }: { factors: GunaResult['factors']; color: string }) {
  const list: Array<[string, GunaFactorDetail]> = [
    ['varna',        factors.varna],
    ['vashya',       factors.vashya],
    ['tara',         factors.tara],
    ['yoni',         factors.yoni],
    ['grahaMaitri',  factors.grahaMaitri],
    ['gana',         factors.gana],
    ['bhakoot',      factors.bhakoot],
    ['nadi',         factors.nadi],
  ];
  return (
    <div className="space-y-2">
      {list.map(([key, f]) => (
        <FactorRow key={key} factor={f} color={color} />
      ))}
    </div>
  );
}

function FactorRow({ factor, color }: { factor: GunaFactorDetail; color: string }) {
  const [open, setOpen] = useState(false);
  const pct = factor.max > 0 ? (factor.score / factor.max) * 100 : 0;
  return (
    <div className="rounded-lg border border-border-light overflow-hidden">
      <button type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background/40">
        <div className="w-28 shrink-0">
          <p className="text-xs font-medium text-foreground leading-tight">{factor.name}</p>
          <p className="text-[10px] text-muted-foreground"
             style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>
            {factor.nameHi}
          </p>
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-border-light overflow-hidden">
          <div className="h-full rounded-full"
               style={{ width: `${pct}%`, background: color, transition: 'width 0.4s ease-out' }} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 w-9 text-right tabular-nums">
          {factor.score}/{factor.max}
        </span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 text-xs text-foreground/85 border-t border-border-light bg-background/30">
          <p className="leading-relaxed">{factor.meaning}</p>
          {(factor.boyValue || factor.girlValue) && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Groom:</span> {factor.boyValue ?? '—'} ·{' '}
              <span className="font-medium text-foreground">Bride:</span> {factor.girlValue ?? '—'}
            </p>
          )}
          {factor.axis && (
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Axis:</span> {factor.axis}</p>
          )}
        </div>
      )}
    </div>
  );
}

function InsightsPane({
  insights,
  yogas,
}: {
  insights: GunaResult['insights'];
  yogas: GunaResult['yogas'];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {(Object.keys(insights) as (keyof GunaResult['insights'])[]).map((key) => {
          const ins = insights[key];
          const meta = DOMAIN_META[key];
          const c = BAND_COLOR[ins.label];
          return (
            <div key={key} className="rounded-lg border border-border-light p-3"
                 style={{ borderLeftWidth: 3, borderLeftColor: c }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  <span className="mr-1">{meta.icon}</span>{meta.label}
                  <span className="ml-2 text-[10px] text-muted-foreground"
                        style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>
                    {meta.hi}
                  </span>
                </p>
                <span className="text-sm font-bold tabular-nums" style={{ color: c }}>
                  {Math.round(ins.score)}<span className="text-xs text-muted-foreground">/100</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-border-light overflow-hidden">
                <div className="h-full rounded-full"
                     style={{ width: `${ins.score}%`, background: c, transition: 'width 0.4s ease-out' }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{ins.summary}</p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border-light pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Yogas</p>
        <div className="grid grid-cols-2 gap-2">
          <YogaCard name="Mahendra"      present={yogas.mahendra.present}     reason={yogas.mahendra.reason} />
          <YogaCard name="Stree Deergha" present={yogas.streeDeergha.present} reason={yogas.streeDeergha.reason} />
        </div>
      </div>
    </div>
  );
}

function YogaCard({ name, present, reason }: { name: string; present: boolean; reason: string }) {
  const c = present ? '#059669' : '#94A3B8';
  return (
    <div className="rounded-lg border border-border-light p-3"
         style={{ borderLeftWidth: 3, borderLeftColor: c }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: `${c}1F`, color: c }}>
          {present ? 'Present' : 'Absent'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{reason}</p>
    </div>
  );
}

function RemediesPane({ remedies }: { remedies: Remedy[] }) {
  if (remedies.length === 0) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
        <p className="text-sm font-semibold text-success">✓ No remedies needed</p>
        <p className="text-xs text-muted-foreground mt-1">No active doshas detected — match is auspicious.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {remedies.map((r) => {
        const c = SEVERITY_COLOR[r.severity];
        return (
          <div key={r.code}
               className="rounded-lg border border-border-light p-3"
               style={{ borderLeftWidth: 3, borderLeftColor: c }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{r.name}</p>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: `${c}1F`, color: c }}>
                {r.dosha}
              </span>
            </div>
            <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{r.description}</p>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground text-center pt-1">
        Remedies are traditional. Consult a qualified astrologer for personalised guidance.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Legacy: simple expandable list when no full result is provided
// ──────────────────────────────────────────────────────────────────

function CollapsibleFactorList({
  factors,
  color,
}: {
  factors: AshtakootFactor[];
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-5 pb-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-medium text-teal hover:text-teal-hover transition-colors"
      >
        <span>View 8 Ashtakoot Factors</span>
        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2.5 border-t border-border-light pt-3">
          {factors.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <p className="text-xs font-medium text-foreground leading-tight">{f.name}</p>
                <p className="text-xs text-muted-foreground"
                   style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>
                  {f.nameHindi}
                </p>
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-border-light overflow-hidden">
                <div className="h-full rounded-full"
                     style={{ width: f.max > 0 ? `${(f.scored / f.max) * 100}%` : '0%',
                              background: color,
                              transition: 'width 0.4s ease-out' }} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0 w-8 text-right">
                {f.scored}/{f.max}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-border animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 rounded bg-border animate-pulse" />
          <div className="h-4 w-24 rounded bg-border-light animate-pulse" />
          <div className="h-3 w-20 rounded bg-border-light animate-pulse" />
        </div>
      </div>
    </div>
  );
}
