'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

/** Small client button that triggers router.refresh() to re-fetch server data. */
export function AdminRefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    router.refresh();
    // reset icon after 800ms so it feels snappy
    setTimeout(() => setSpinning(false), 800);
  }

  return (
    <button
      onClick={handleRefresh}
      aria-label="Refresh dashboard data"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm transition-all duration-150 hover:border-gold/60 hover:text-primary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${spinning ? 'animate-spin text-primary' : ''}`}
      />
      Refresh
    </button>
  );
}
