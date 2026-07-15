'use client';

import { useEffect, useState } from 'react';
import type { FiiCompatibility } from '@smartshaadi/types';
import { fetchFiiCompatibility } from '@/app/actions/ai';

interface Props {
  matchId: string;
}

export function FiiCardBadge({ matchId }: Props) {
  const [data, setData] = useState<FiiCompatibility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFiiCompatibility(matchId, false)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading || !data) return null;

  const aSteady = data.profile_a_score.score === 50;
  const bSteady = data.profile_b_score.score === 50;
  if (aSteady && bSteady) return null;

  const color = data.compatibility_color;

  return (
    <span
      className="inline-flex h-6 items-center rounded-full px-2.5 text-2xs font-medium border"
      style={{
        backgroundColor: `${color}26`,
        borderColor: `${color}4D`,
        color,
      }}
    >
      {data.compatibility}
    </span>
  );
}
