'use client';

import { useState } from 'react';
import { Heart, Loader2, Check } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function CreateMatchButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleClick() {
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/v1/dev/seed-compatible-match`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('done');
      // Reload /feed if we're there, else navigate
      if (window.location.pathname === '/feed' || window.location.pathname === '/matches') {
        window.location.reload();
      } else {
        window.location.href = '/feed';
      }
    } catch {
      setStatus('error');
    }
  }

  const labelMap = {
    idle:    'Seed Match',
    loading: 'Creating…',
    done:    'Match Created',
    error:   'Try Again',
  };

  const Icon =
    status === 'loading' ? Loader2 :
    status === 'done'    ? Check :
    Heart;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'loading'}
      className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/15 disabled:opacity-50"
      title="Dev: create a match engineered for the current user"
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {labelMap[status]}
    </button>
  );
}
