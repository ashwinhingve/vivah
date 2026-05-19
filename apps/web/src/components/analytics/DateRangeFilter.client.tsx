'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'custom', label: 'Custom' },
];

export function DateRangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = params.get('range') ?? '30';
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');

  function push(next: URLSearchParams) {
    startTransition(() => {
      router.push(`/admin/analytics?${next.toString()}`);
    });
  }

  function selectPreset(key: string) {
    const next = new URLSearchParams();
    next.set('range', key);
    if (key === 'custom' && from && to) {
      next.set('from', from);
      next.set('to', to);
    }
    push(next);
  }

  function applyCustom() {
    if (!from || !to) return;
    const next = new URLSearchParams();
    next.set('range', 'custom');
    next.set('from', from);
    next.set('to', to);
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="inline-flex overflow-hidden rounded-lg border border-gold/30"
        role="group"
        aria-label="Date range"
      >
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p.key)}
            disabled={pending}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
              active === p.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface text-text-muted hover:bg-surface-muted',
            )}
            aria-pressed={active === p.key}
          >
            {p.label}
          </button>
        ))}
      </div>

      {active === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gold/30 bg-surface px-2 py-1.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            aria-label="From date"
          />
          <span className="text-sm text-text-muted">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gold/30 bg-surface px-2 py-1.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            aria-label="To date"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={pending || !from || !to}
            className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-teal-foreground transition-colors hover:bg-teal-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
