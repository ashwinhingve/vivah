/**
 * Smart Shaadi — ManglikChip
 * apps/web/src/components/profile/ManglikChip.tsx
 *
 * Renders a small pill showing manglik status. Returns null when null/unknown
 * so cross-religion profiles don't show an irrelevant astrological badge.
 */

interface Props {
  manglik?: 'YES' | 'NO' | 'PARTIAL' | null;
  size?: 'sm' | 'xs';
}

export function ManglikChip({ manglik, size = 'sm' }: Props) {
  if (!manglik) return null;
  const cls = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';
  if (manglik === 'YES') {
    return <span className={`rounded-full font-semibold bg-amber-100 text-amber-800 ${cls}`}>Manglik</span>;
  }
  if (manglik === 'PARTIAL') {
    return <span className={`rounded-full font-semibold border border-amber-300 text-amber-700 ${cls}`}>Partial Manglik</span>;
  }
  return <span className={`rounded-full font-semibold bg-slate-100 text-slate-700 ${cls}`}>Non-Manglik</span>;
}
