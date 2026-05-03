import type { JSX } from 'react';

interface Props {
  distanceKm: number | null;
  fallbackCity: string | null;
}

export function DistancePill({ distanceKm, fallbackCity }: Props): JSX.Element | null {
  if (distanceKm !== null && distanceKm < 50) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
        {distanceKm}km away
      </span>
    );
  }
  if (fallbackCity) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-foreground">
        {fallbackCity}
      </span>
    );
  }
  return null;
}
