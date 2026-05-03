import type { GuestSummary, MealPref } from '@smartshaadi/types';

interface RsvpStatsProps {
  guests: GuestSummary[];
}

const RSVP_CONFIG = {
  YES:     { label: 'Attending',  color: '#0E7C7B' },
  NO:      { label: 'Declined',   color: '#DC2626' },
  MAYBE:   { label: 'Maybe',      color: '#D97706' },
  PENDING: { label: 'Pending',    color: '#94A3B8' },
} as const;

const MEAL_CONFIG: Record<MealPref, { label: string; color: string }> = {
  VEG:           { label: 'Veg',           color: '#059669' },
  NON_VEG:       { label: 'Non-Veg',       color: '#DC2626' },
  JAIN:          { label: 'Jain',          color: '#D97706' },
  VEGAN:         { label: 'Vegan',         color: '#7C3AED' },
  EGGETARIAN:    { label: 'Eggetarian',    color: '#0891B2' },
  NO_PREFERENCE: { label: 'No preference', color: '#64748B' },
};

export function RsvpStats({ guests }: RsvpStatsProps) {
  const total = guests.length;

  // RSVP counts
  const rsvpCounts = {
    YES:     guests.filter((g) => g.rsvpStatus === 'YES').length,
    NO:      guests.filter((g) => g.rsvpStatus === 'NO').length,
    MAYBE:   guests.filter((g) => g.rsvpStatus === 'MAYBE').length,
    PENDING: guests.filter((g) => g.rsvpStatus === 'PENDING').length,
  };

  // Meal pref counts (only for confirmed guests)
  const attending = guests.filter((g) => g.rsvpStatus === 'YES');
  const mealCounts: Record<MealPref, number> = {
    VEG:           attending.filter((g) => g.mealPref === 'VEG').length,
    NON_VEG:       attending.filter((g) => g.mealPref === 'NON_VEG').length,
    JAIN:          attending.filter((g) => g.mealPref === 'JAIN').length,
    VEGAN:         attending.filter((g) => g.mealPref === 'VEGAN').length,
    EGGETARIAN:    attending.filter((g) => g.mealPref === 'EGGETARIAN').length,
    NO_PREFERENCE: attending.filter((g) => g.mealPref === 'NO_PREFERENCE').length,
  };
  const mealTotal = Object.values(mealCounts).reduce((s, n) => s + n, 0);

  // Build conic-gradient for donut
  let cumulativePct = 0;
  const gradientStops = (Object.keys(MEAL_CONFIG) as MealPref[])
    .filter((k) => mealCounts[k] > 0)
    .map((k) => {
      const p = mealTotal > 0 ? (mealCounts[k] / mealTotal) * 100 : 0;
      const stop = `${MEAL_CONFIG[k].color} ${cumulativePct}% ${cumulativePct + p}%`;
      cumulativePct += p;
      return stop;
    });

  const conicGradient =
    gradientStops.length > 0
      ? `conic-gradient(${gradientStops.join(', ')})`
      : `conic-gradient(#E2E8F0 0% 100%)`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {/* RSVP badges */}
      <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4">
        <h3 className="font-medium text-sm text-foreground mb-3">RSVP Summary</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RSVP_CONFIG) as (keyof typeof RSVP_CONFIG)[]).map((status) => {
            const count = rsvpCounts[status];
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div
                key={status}
                className="flex flex-col items-center px-3 py-2 rounded-lg border min-w-[68px]"
                style={{ borderColor: `${RSVP_CONFIG[status].color}30`, backgroundColor: `${RSVP_CONFIG[status].color}08` }}
              >
                <span className="text-lg font-bold" style={{ color: RSVP_CONFIG[status].color }}>
                  {count}
                </span>
                <span className="text-[10px] text-muted-foreground">{RSVP_CONFIG[status].label}</span>
                <span className="text-[10px] font-medium" style={{ color: RSVP_CONFIG[status].color }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{total} total guests</p>
      </div>

      {/* Meal preference donut */}
      <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4">
        <h3 className="font-medium text-sm text-foreground mb-3">
          Meal Preferences
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(attending only)</span>
        </h3>
        {mealTotal > 0 ? (
          <div className="flex items-center gap-4">
            {/* CSS donut */}
            <div
              className="shrink-0 w-16 h-16 rounded-full"
              style={{
                background: conicGradient,
                mask:       'radial-gradient(circle at center, transparent 45%, black 46%)',
                WebkitMask: 'radial-gradient(circle at center, transparent 45%, black 46%)',
              }}
              aria-hidden="true"
            />
            {/* Legend */}
            <div className="flex flex-col gap-1">
              {(Object.keys(MEAL_CONFIG) as MealPref[])
                .filter((k) => mealCounts[k] > 0)
                .map((k) => (
                  <div key={k} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: MEAL_CONFIG[k].color }}
                    />
                    <span className="text-muted-foreground">{MEAL_CONFIG[k].label}</span>
                    <span className="font-medium text-foreground ml-auto pl-2">{mealCounts[k]}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No meal preferences recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
