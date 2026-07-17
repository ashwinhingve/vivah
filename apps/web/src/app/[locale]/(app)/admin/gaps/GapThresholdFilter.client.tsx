'use client';

import { useRouter } from '@/i18n/navigation';

const OPTIONS = [2, 3, 5, 10];

export function GapThresholdFilter({ threshold }: { threshold: number }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-text">
      <span className="text-gold-muted">Min vendors / market</span>
      <select
        value={threshold}
        onChange={(e) => router.push(`/admin/gaps?threshold=${e.target.value}`)}
        className="h-11 rounded-lg border border-gold/30 bg-surface px-3 text-sm text-text focus:border-teal focus:outline-none"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
