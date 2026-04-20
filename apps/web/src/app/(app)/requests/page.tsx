'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MatchRequest, MatchRequestsResponse } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('better-auth.session_token='))
      ?.split('=')[1] ?? null
  );
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getSessionToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

function parseRequests(raw: unknown): MatchRequest[] {
  if (
    typeof raw === 'object' && raw !== null &&
    'success' in raw && (raw as Record<string, unknown>)['success'] === true
  ) {
    const data = (raw as { success: true; data: MatchRequestsResponse }).data;
    return data.requests ?? [];
  }
  return [];
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-700' },
  ACCEPTED:  { label: 'Accepted',  cls: 'bg-green-50 text-green-700' },
  DECLINED:  { label: 'Declined',  cls: 'bg-red-50 text-red-600' },
  WITHDRAWN: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-500' },
  BLOCKED:   { label: 'Blocked',   cls: 'bg-gray-100 text-gray-500' },
  EXPIRED:   { label: 'Expired',   cls: 'bg-gray-100 text-gray-500' },
};

export default function RequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<MatchRequest[]>([]);
  const [sent, setSent] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, sRes] = await Promise.all([
        apiFetch('/api/v1/matchmaking/requests/received?limit=100'),
        apiFetch('/api/v1/matchmaking/requests/sent?limit=100'),
      ]);
      if (rRes.status === 401 || sRes.status === 401) {
        router.push('/login');
        return;
      }
      const [rJson, sJson] = await Promise.all([rRes.json(), sRes.json()]);
      setReceived(parseRequests(rJson as unknown));
      setSent(parseRequests(sJson as unknown));
    } catch {
      setError('Failed to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function handleAccept(id: string) {
    setPending((p) => new Set(p).add(id));
    const prev = received;
    setReceived((r) => r.map((x) => x.id === id ? { ...x, status: 'ACCEPTED' as const } : x));
    try {
      const res = await apiFetch(`/api/v1/matchmaking/requests/${id}/accept`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setReceived(prev);
      setActionError((e) => ({ ...e, [id]: 'Could not accept — please try again' }));
      setTimeout(() => setActionError((e) => { const n = { ...e }; delete n[id]; return n; }), 3000);
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  async function handleDecline(id: string) {
    setPending((p) => new Set(p).add(id));
    const prev = received;
    setReceived((r) => r.map((x) => x.id === id ? { ...x, status: 'DECLINED' as const } : x));
    try {
      const res = await apiFetch(`/api/v1/matchmaking/requests/${id}/decline`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setReceived(prev);
      setActionError((e) => ({ ...e, [id]: 'Could not decline — please try again' }));
      setTimeout(() => setActionError((e) => { const n = { ...e }; delete n[id]; return n; }), 3000);
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  async function handleWithdraw(id: string) {
    setPending((p) => new Set(p).add(id));
    const prev = sent;
    setSent((s) => s.map((x) => x.id === id ? { ...x, status: 'WITHDRAWN' as const } : x));
    try {
      const res = await apiFetch(`/api/v1/matchmaking/requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setSent(prev);
      setActionError((e) => ({ ...e, [id]: 'Could not withdraw — please try again' }));
      setTimeout(() => setActionError((e) => { const n = { ...e }; delete n[id]; return n; }), 3000);
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  const pendingReceived = received.filter((r) => r.status === 'PENDING');
  const pastReceived    = received.filter((r) => r.status !== 'PENDING');
  const pendingSent     = sent.filter((r) => r.status === 'PENDING');
  const pastSent        = sent.filter((r) => r.status !== 'PENDING');

  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#7B2D42] font-heading">Requests</h1>
          <p className="text-sm text-[#6B6B76] mt-0.5">Manage your match interests</p>
        </div>

        {/* Tab bar */}
        <div className="flex rounded-lg bg-white border border-[#E8E0D8] p-1 gap-1">
          {(['received', 'sent'] as const).map((t) => {
            const count = t === 'received' ? pendingReceived.length : pendingSent.length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[44px] ${
                  tab === t
                    ? 'bg-[#7B2D42] text-white shadow-sm'
                    : 'text-[#6B6B76] hover:text-[#2E2E38]'
                }`}
              >
                {t === 'received' ? 'Received' : 'Sent'}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === t ? 'bg-white/20' : 'bg-[#7B2D42]/10 text-[#7B2D42]'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white border border-[#E8E0D8] animate-pulse" />
            ))}
          </div>
        )}

        {/* Received tab */}
        {!loading && tab === 'received' && (
          <div className="space-y-3">
            {pendingReceived.length === 0 && pastReceived.length === 0 && (
              <div className="text-center py-12 text-[#6B6B76] text-sm">
                No requests received yet. Explore profiles to get noticed!
              </div>
            )}

            {pendingReceived.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-[#E8E0D8] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#7B2D42]/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#7B2D42]">{shortId(r.senderId).slice(0, 2)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profiles/${r.senderId}`} className="text-sm font-semibold text-[#2E2E38] hover:text-[#0E7C7B] transition-colors">
                      Profile #{shortId(r.senderId)}
                    </Link>
                    <p className="text-xs text-[#6B6B76]">{timeAgo(r.createdAt)}</p>
                  </div>
                </div>
                {r.message && (
                  <p className="text-xs text-[#6B6B76] italic border-l-2 border-[#C5A47E] pl-2 line-clamp-2">
                    &ldquo;{r.message}&rdquo;
                  </p>
                )}
                {actionError[r.id] && (
                  <p className="text-xs text-red-500">{actionError[r.id]}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleAccept(r.id)}
                    disabled={pending.has(r.id)}
                    className="flex-1 bg-[#0E7C7B] text-white text-sm font-semibold rounded-lg py-2.5 min-h-[44px] hover:bg-[#149998] transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDecline(r.id)}
                    disabled={pending.has(r.id)}
                    className="flex-1 border border-[#E8E0D8] text-[#6B6B76] text-sm font-semibold rounded-lg py-2.5 min-h-[44px] hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}

            {pastReceived.length > 0 && (
              <details className="group">
                <summary className="text-xs font-medium text-[#6B6B76] cursor-pointer py-2 list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  Past requests ({pastReceived.length})
                </summary>
                <div className="space-y-2 mt-2">
                  {pastReceived.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE['EXPIRED']!;
                    return (
                      <div key={r.id} className="bg-white rounded-xl border border-[#E8E0D8] px-4 py-3 flex items-center gap-3 opacity-70">
                        <Link href={`/profiles/${r.senderId}`} className="text-sm text-[#2E2E38] hover:text-[#0E7C7B] flex-1 min-w-0 truncate">
                          Profile #{shortId(r.senderId)}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Sent tab */}
        {!loading && tab === 'sent' && (
          <div className="space-y-3">
            {pendingSent.length === 0 && pastSent.length === 0 && (
              <div className="text-center py-12 text-[#6B6B76] text-sm">
                You haven&apos;t sent any interests yet.{' '}
                <Link href="/feed" className="text-[#0E7C7B] font-semibold">Browse profiles →</Link>
              </div>
            )}

            {pendingSent.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-[#E8E0D8] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0E7C7B]/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#0E7C7B]">{shortId(r.receiverId).slice(0, 2)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profiles/${r.receiverId}`} className="text-sm font-semibold text-[#2E2E38] hover:text-[#0E7C7B] transition-colors">
                      Profile #{shortId(r.receiverId)}
                    </Link>
                    <p className="text-xs text-[#6B6B76]">Sent {timeAgo(r.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium shrink-0">
                    Awaiting response
                  </span>
                </div>
                {r.message && (
                  <p className="text-xs text-[#6B6B76] italic border-l-2 border-[#C5A47E] pl-2 line-clamp-2">
                    &ldquo;{r.message}&rdquo;
                  </p>
                )}
                {actionError[r.id] && (
                  <p className="text-xs text-red-500">{actionError[r.id]}</p>
                )}
                <button
                  type="button"
                  onClick={() => void handleWithdraw(r.id)}
                  disabled={pending.has(r.id)}
                  className="w-full border border-[#E8E0D8] text-[#6B6B76] text-sm font-medium rounded-lg py-2 min-h-[44px] hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  Withdraw
                </button>
              </div>
            ))}

            {pastSent.length > 0 && (
              <details className="group">
                <summary className="text-xs font-medium text-[#6B6B76] cursor-pointer py-2 list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  Past requests ({pastSent.length})
                </summary>
                <div className="space-y-2 mt-2">
                  {pastSent.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE['EXPIRED']!;
                    return (
                      <div key={r.id} className="bg-white rounded-xl border border-[#E8E0D8] px-4 py-3 flex items-center gap-3 opacity-70">
                        <Link href={`/profiles/${r.receiverId}`} className="text-sm text-[#2E2E38] hover:text-[#0E7C7B] flex-1 min-w-0 truncate">
                          Profile #{shortId(r.receiverId)}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
