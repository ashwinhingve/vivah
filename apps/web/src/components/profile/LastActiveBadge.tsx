/**
 * Smart Shaadi — LastActiveBadge
 * apps/web/src/components/profile/LastActiveBadge.tsx
 *
 * Tier-aware presence badge. FREE viewers see only "Recently active" without
 * timestamp precision (privacy). STANDARD+ see exact "Online now / 2h ago".
 */

interface Props {
  lastActiveAt?: string | Date | null;
  showPrecise?: boolean;
}

function formatDelta(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 5)   return 'Online now';
  if (m < 60)  return `Active ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `Active ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `Active ${d}d ago`;
  return 'Active recently';
}

export function LastActiveBadge({ lastActiveAt, showPrecise = false }: Props) {
  if (!lastActiveAt) return null;
  const ts = typeof lastActiveAt === 'string' ? new Date(lastActiveAt).getTime() : lastActiveAt.getTime();
  const delta = Date.now() - ts;
  const label = showPrecise ? formatDelta(delta) : 'Recently active';
  const isOnline = delta < 5 * 60_000 && showPrecise;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-muted-foreground'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-muted'}`} />
      {label}
    </span>
  );
}
