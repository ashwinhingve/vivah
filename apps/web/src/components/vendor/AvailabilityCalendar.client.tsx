'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AvailabilityCalendarProps {
  vendorId:    string;
  selectedDate?: string | null;
  onSelect?:   (date: string) => void;
  className?:  string;
}

interface AvailabilityResponse {
  success: boolean;
  data: {
    bookedDates:  string[];
    blockedDates: { date: string; reason: string | null }[];
  };
}

function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AvailabilityCalendar({
  vendorId, selectedDate, onSelect, className = '',
}: AvailabilityCalendarProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const [booked, setBooked]   = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(false);

  const month = formatYearMonth(cursor);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/vendors/${vendorId}/availability?month=${month}`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<AvailabilityResponse>)
      .then((j) => {
        if (j.success) {
          setBooked(new Set(j.data.bookedDates));
          setBlocked(new Map(j.data.blockedDates.map((b) => [b.date, b.reason])));
        }
      })
      .catch(() => { /* swallow */ })
      .finally(() => setLoading(false));
  }, [vendorId, month]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const m0 = cursor.getMonth();
    const firstDow = new Date(year, m0, 1).getDay();
    const total = daysInMonth(year, m0);
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      cells.push(`${year}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [cursor]);

  const today = todayISO();

  function shift(delta: number) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }

  return (
    <div className={`rounded-xl border border-gold/30 bg-surface p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg p-2 hover:bg-gold/10"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold text-primary">
          {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg p-2 hover:bg-gold/10"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const isPast    = d < today;
          const isBooked  = booked.has(d);
          const isBlocked = blocked.has(d);
          const isSelected = d === selectedDate;
          const dayNum = parseInt(d.slice(-2), 10);

          const disabled = isPast || isBooked || isBlocked;
          const base = 'aspect-square flex items-center justify-center text-sm rounded-lg transition-colors';
          const color = isSelected
            ? 'bg-teal text-white font-semibold'
            : isPast
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : isBooked
                ? 'bg-destructive/10 text-destructive cursor-not-allowed'
                : isBlocked
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                  : 'hover:bg-teal/10 cursor-pointer text-foreground';

          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(d)}
              title={isBlocked ? `Blocked${blocked.get(d) ? ': ' + blocked.get(d) : ''}` : isBooked ? 'Already booked' : ''}
              className={`${base} ${color}`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal" /> Selected
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive/10 border border-destructive/30" /> Booked
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-secondary border border-border" /> Blocked
        </span>
        {loading && <span>Loading…</span>}
      </div>
    </div>
  );
}
