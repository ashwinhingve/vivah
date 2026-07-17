'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeatmapDay {
  date: string;
  auspiciousBand: string;
  kinds: Array<{ kind: string; count: number }>;
  demand: number;
}

interface HeatmapCalendarProps {
  days: HeatmapDay[];
  month: string;
}

export function HeatmapCalendar({ days, month: initialMonth }: HeatmapCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Parse month
  const parts = currentMonth.split('-');
  const yearStr = parts[0] ?? '2024';
  const monthStr = parts[1] ?? '01';
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  // Build day map
  const dayMap = new Map<string, HeatmapDay>();
  days.forEach(day => {
    dayMap.set(day.date, day);
  });

  // Generate calendar grid
  const firstDay = new Date(year, monthNum - 1, 1);
  const lastDay = new Date(year, monthNum, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = new Array(startingDayOfWeek).fill(null);

  for (let i = 1; i <= daysInMonth; i++) {
    week.push(i);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  // Band color mapping
  const bandColors: Record<string, { bg: string; border: string }> = {
    PEAK: { bg: 'bg-gold', border: 'border-gold' },
    HIGH: { bg: 'bg-gold/80', border: 'border-gold/80' },
    MEDIUM: { bg: 'bg-gold/60', border: 'border-gold/60' },
    LOW: { bg: 'bg-gold/40', border: 'border-gold/40' },
    NONE: { bg: 'bg-background', border: 'border-gold/20' },
  };

  const defaultBandColor = { bg: 'bg-background', border: 'border-gold/20' };

  // Kind colors
  const kindColors: Record<string, string> = {
    MUHURAT: 'bg-teal text-teal',
    FESTIVAL: 'bg-primary text-primary',
    SCHOOL: 'bg-warning text-warning',
    GOVT: 'bg-warning text-warning',
    REGIONAL: 'bg-teal/50 text-teal/50',
    BLACKOUT: 'bg-destructive text-destructive',
  };

  const handlePrevMonth = () => {
    const p = currentMonth.split('-');
    const y = p[0] ?? '2024';
    const m = p[1] ?? '01';
    let month = parseInt(m, 10) - 1;
    let year = parseInt(y, 10);
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setCurrentMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const p = currentMonth.split('-');
    const y = p[0] ?? '2024';
    const m = p[1] ?? '01';
    let month = parseInt(m, 10) + 1;
    let year = parseInt(y, 10);
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setCurrentMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const monthName = new Date(year, monthNum - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-2xl bg-surface border border-gold/20 shadow-card p-6">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">{monthName}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="h-10 w-10 p-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="h-10 w-10 p-0"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gold border border-gold" />
          <span className="text-sm text-foreground">Peak Auspicious</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gold/60 border border-gold/60" />
          <span className="text-sm text-foreground">Moderate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-background border border-gold/20" />
          <span className="text-sm text-foreground">No Event</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gold-muted py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 bg-background rounded-lg p-2">
        {weeks.map((week, weekIdx) =>
          week.map((dayNum, dayIdx) => {
            if (dayNum === null) {
              return (
                <div
                  key={`empty-${weekIdx}-${dayIdx}`}
                  className="aspect-square rounded-lg bg-background"
                />
              );
            }

            const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayData = dayMap.get(dateStr);
            const bandKey = dayData?.auspiciousBand ?? 'NONE';
            const bandColor = bandColors[bandKey] ?? defaultBandColor;
            const isHovered = hoveredDate === dateStr;

            return (
              <div
                key={dateStr}
                className={`
                  aspect-square rounded-lg border-2 p-1 cursor-pointer
                  transition-all duration-200 relative
                  ${bandColor?.bg ?? defaultBandColor.bg} ${bandColor?.border ?? defaultBandColor.border}
                  ${isHovered ? 'ring-2 ring-teal shadow-md' : ''}
                `}
                onMouseEnter={() => setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <div className="text-xs font-semibold text-foreground mb-0.5">
                  {dayNum}
                </div>

                {/* Show kinds as small badges */}
                {dayData && dayData.kinds.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {dayData.kinds.slice(0, 2).map((k, idx) => (
                      <div
                        key={`${dateStr}-${k.kind}-${idx}`}
                        className="text-[10px] px-1 rounded text-white bg-teal/70 truncate"
                        title={k.kind}
                      >
                        {k.kind.slice(0, 3).toUpperCase()}
                      </div>
                    ))}
                    {dayData.kinds.length > 2 && (
                      <div className="text-[10px] px-0.5 text-muted-foreground">
                        +{dayData.kinds.length - 2}
                      </div>
                    )}
                  </div>
                )}

                {/* Tooltip on hover */}
                {isHovered && dayData && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-primary text-white text-xs rounded p-2 whitespace-nowrap z-10 shadow-lg">
                    <div className="font-semibold">
                      {dayData.auspiciousBand} Auspicious
                    </div>
                    <div className="text-xs opacity-90">
                      {dayData.kinds.length} event(s)
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Event list for hovered date */}
      {hoveredDate && dayMap.has(hoveredDate) && (
        <div className="mt-6 border-t border-gold/20 pt-4">
          <h3 className="text-sm font-semibold text-primary mb-3">
            Events on {new Date(hoveredDate).toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h3>
          <div className="space-y-2">
            {dayMap.get(hoveredDate)!.kinds.map((k, idx) => (
              <div
                key={`detail-${hoveredDate}-${k.kind}-${idx}`}
                className="flex items-center gap-2 text-sm"
              >
                <Badge
                  variant="outline"
                  className={`${kindColors[k.kind] ?? 'bg-teal text-teal'} border-0`}
                >
                  {k.kind}
                </Badge>
                <span className="text-muted-foreground">({k.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
