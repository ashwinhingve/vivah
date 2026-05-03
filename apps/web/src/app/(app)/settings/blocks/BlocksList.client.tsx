'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, ShieldOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { BlockedUser } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export function BlocksList() {
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/blocks`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      const body = (await res.json()) as { success: boolean; data: { blocks: BlockedUser[] } };
      setBlocks(body.data?.blocks ?? []);
    } catch {
      setError('Failed to load blocked profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function unblock(b: BlockedUser) {
    if (!confirm(`Unblock ${b.name ?? 'this profile'}? They will be able to send you requests again.`)) return;
    setBusyId(b.profileId);
    const prev = blocks;
    setBlocks((bs) => bs.filter((x) => x.profileId !== b.profileId));
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/block/${b.profileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setBlocks(prev);
      setError('Could not unblock — please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 text-sm text-destructive">
        {error} <button type="button" onClick={() => void load()} className="underline ml-1">Retry</button>
      </Card>
    );
  }

  if (blocks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ShieldOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No blocked profiles.</p>
        <p className="text-xs text-muted-foreground mt-1">When you block someone, they show up here.</p>
      </Card>
    );
  }

  return (
    <Card className="p-2 divide-y divide-border">
      {blocks.map((b) => (
        <div key={b.blockId} className="flex items-center gap-3 px-3 py-3">
          <div className="h-10 w-10 rounded-full bg-muted grid place-items-center shrink-0 text-muted-foreground font-bold">
            {b.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/profiles/${b.profileId}`}
              className="text-sm font-semibold text-foreground hover:text-teal truncate block"
            >
              {b.name ?? `Profile ${b.profileId.slice(0, 6)}`}
            </Link>
            <p className="text-xs text-muted-foreground">
              Blocked {timeAgo(b.blockedAt)}{b.reason ? ` · ${b.reason}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void unblock(b)}
            disabled={busyId === b.profileId}
            className="rounded-lg border border-border text-sm font-medium px-3 py-2 hover:border-primary hover:text-primary disabled:opacity-50 min-h-[40px] flex items-center gap-1.5"
          >
            {busyId === b.profileId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Unblock
          </button>
        </div>
      ))}
    </Card>
  );
}
