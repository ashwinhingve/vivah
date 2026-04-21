'use client';

import { useState } from 'react';

interface AshtakootFactor {
  name: string;
  nameHindi: string;
  scored: number;
  max: number;
}

interface CompatibilityDisplayProps {
  gunaScore: number;
  factors?: AshtakootFactor[];
  isLoading?: boolean;
}

const DEFAULT_FACTORS: AshtakootFactor[] = [
  { name: 'Varna', nameHindi: 'वर्ण', scored: 0, max: 1 },
  { name: 'Vashya', nameHindi: 'वश्य', scored: 0, max: 2 },
  { name: 'Tara', nameHindi: 'तारा', scored: 0, max: 3 },
  { name: 'Yoni', nameHindi: 'योनि', scored: 0, max: 4 },
  { name: 'Graha Maitri', nameHindi: 'ग्रह मैत्री', scored: 0, max: 5 },
  { name: 'Gana', nameHindi: 'गण', scored: 0, max: 6 },
  { name: 'Bhakoot', nameHindi: 'भकूट', scored: 0, max: 7 },
  { name: 'Nadi', nameHindi: 'नाड़ी', scored: 0, max: 8 },
];

function getScoreConfig(score: number): { color: string; label: string } {
  if (score <= 17) return { color: '#DC2626', label: 'Low Compatibility' };
  if (score <= 24) return { color: '#D97706', label: 'Moderate' };
  if (score <= 32) return { color: '#0E7C7B', label: 'Good Compatibility' };
  return { color: '#059669', label: 'Excellent Match' };
}

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function CompatibilityDisplay({
  gunaScore,
  factors,
  isLoading = false,
}: CompatibilityDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const resolvedFactors = factors ?? DEFAULT_FACTORS;
  const { color, label } = getScoreConfig(gunaScore);
  const progress = Math.min(gunaScore / 36, 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  if (isLoading) {
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

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
      {/* Header row: ring + label */}
      <div className="flex items-center gap-5">
        {/* SVG circular progress */}
        <div className="relative shrink-0 w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none"
              stroke="#F0EBE4"
              strokeWidth="8"
            />
            {/* Progress */}
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
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold leading-none" style={{ color }}>
              {gunaScore}
            </span>
            <span className="text-xs text-muted-foreground">/36</span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <p
            className="text-xl font-semibold text-primary"
            style={{ fontFamily: '"Noto Serif Devanagari", "Playfair Display", serif' }}
          >
            गुण मिलान
          </p>
          <p className="text-sm text-muted-foreground">Guna Milan Compatibility</p>
          <span
            className="inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: `${color}18`, color }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Expandable factors */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 w-full flex items-center justify-between text-sm font-medium text-teal hover:text-teal-hover transition-colors"
      >
        <span>View 8 Ashtakoot Factors</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5 border-t border-border-light pt-3">
          {resolvedFactors.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <p className="text-xs font-medium text-foreground leading-tight">{f.name}</p>
                <p
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}
                >
                  {f.nameHindi}
                </p>
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-border-light overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: f.max > 0 ? `${(f.scored / f.max) * 100}%` : '0%',
                    background: color,
                    transition: 'width 0.4s ease-out',
                  }}
                />
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
