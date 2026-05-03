'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart, Star, Clock, CheckCheck, Flag, MoreHorizontal, ShieldX, Sparkles, Verified,
  Loader2, X,
} from 'lucide-react';
import type { EnrichedMatchRequest } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const DECLINE_REASONS: { value: string; label: string }[] = [
  { value: 'NOT_INTERESTED',           label: 'Not interested right now' },
  { value: 'NOT_MATCHING_PREFERENCES', label: 'Doesn’t match my preferences' },
  { value: 'INCOMPLETE_PROFILE',       label: 'Profile feels incomplete' },
  { value: 'PHOTO_HIDDEN',             label: 'Photo is hidden' },
  { value: 'INAPPROPRIATE_MESSAGE',    label: 'Message felt inappropriate' },
  { value: 'OTHER',                    label: 'Other' },
];

const REPORT_CATEGORIES: { value: string; label: string; tone: string }[] = [
  { value: 'HARASSMENT',            label: 'Harassment / abusive language', tone: 'text-destructive' },
  { value: 'FAKE_PROFILE',          label: 'Fake or impersonated profile',  tone: 'text-warning' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate photos / content', tone: 'text-warning' },
  { value: 'SCAM',                  label: 'Scam / asking for money',        tone: 'text-destructive' },
  { value: 'UNDERAGE',              label: 'Underage / minor',                tone: 'text-destructive' },
  { value: 'SPAM',                  label: 'Spam / repeated unwanted contact', tone: 'text-warning' },
  { value: 'OTHER',                 label: 'Other',                            tone: 'text-muted-foreground' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-warning/10 text-warning' },
  ACCEPTED:  { label: 'Matched',   cls: 'bg-success/10 text-success' },
  DECLINED:  { label: 'Declined',  cls: 'bg-destructive text-destructive' },
  WITHDRAWN: { label: 'Withdrawn', cls: 'bg-secondary text-muted-foreground' },
  BLOCKED:   { label: 'Blocked',   cls: 'bg-secondary text-muted-foreground' },
  EXPIRED:   { label: 'Expired',   cls: 'bg-secondary text-muted-foreground' },
};

function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;
  return document.cookie.split('; ').find((row) => row.startsWith('better-auth.session_token='))?.split('=')[1] ?? null;
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function expiresIn(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const d = Math.floor(ms / 86_400_000);
  if (d > 1)  return `expires in ${d}d`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `expires in ${h}h`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return `expires in ${m}m`;
}

function lastActiveLabel(iso: string | null): string | null {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 5)   return 'Online now';
  if (m < 60)  return `Active ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Active ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `Active ${d}d ago`;
  return null;
}

interface DeclineModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => Promise<void>;
}

function DeclineModal({ open, onClose, onConfirm }: DeclineModalProps) {
  const [selected, setSelected] = useState<string>('NOT_INTERESTED');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-primary font-heading">Decline this request?</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Your reason stays private. The sender only sees that you declined.
        </p>
        <div className="space-y-2 mb-4">
          {DECLINE_REASONS.map((r) => (
            <label key={r.value} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${selected === r.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input
                type="radio"
                name="decline-reason"
                value={r.value}
                checked={selected === r.value}
                onChange={() => setSelected(r.value)}
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm">{r.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-surface min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(selected); onClose(); } finally { setBusy(false); }
            }}
            className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-white hover:bg-destructive min-h-[44px] flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Decline
          </button>
        </div>
      </div>
    </div>
  );
}

interface AcceptModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (welcomeMessage: string | null) => Promise<void>;
  counterpartyName: string | null;
}

function AcceptModal({ open, onClose, onConfirm, counterpartyName }: AcceptModalProps) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-primary font-heading">
            Accept {counterpartyName ?? 'this request'}?
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Add an optional welcome note. They’ll see it as the first message in your chat.
        </p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value.slice(0, 500))}
          placeholder="Hi! Looking forward to getting to know you..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <div className="text-right text-xs text-muted-foreground mt-1">{msg.length} / 500</div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-muted-foreground min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(msg.trim() || null); onClose(); } finally { setBusy(false); }
            }}
            className="flex-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-white hover:bg-success min-h-[44px] flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (category: string, details: string | null) => Promise<void>;
}

function ReportModal({ open, onClose, onConfirm }: ReportModalProps) {
  const [category, setCategory] = useState<string>('HARASSMENT');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-primary font-heading">Report profile</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Reports stay confidential. Our moderation team reviews every one within 24h.
        </p>
        <div className="space-y-2 mb-3">
          {REPORT_CATEGORIES.map((c) => (
            <label key={c.value} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${category === c.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input
                type="radio"
                name="report-category"
                value={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                className="h-4 w-4 text-primary"
              />
              <span className={`text-sm ${c.tone}`}>{c.label}</span>
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
          placeholder="Optional: tell us more..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="text-right text-xs text-muted-foreground mt-1">{details.length} / 1000</div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(category, details.trim() || null); onClose(); } finally { setBusy(false); }
            }}
            className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-white hover:bg-destructive min-h-[44px] flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

interface RequestCardProps {
  r: EnrichedMatchRequest;
  side: 'received' | 'sent';
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
  onBlock: () => void;
  onReport: () => void;
}

function RequestCard({ r, side, busy, onAccept, onDecline, onWithdraw, onBlock, onReport }: RequestCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isSuper = r.priority === 'SUPER_LIKE';
  const expires = side === 'received' && r.status === 'PENDING' ? expiresIn(r.expiresAt) : null;
  const lastActive = lastActiveLabel(r.lastActiveAt);

  const initial = r.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className={`rounded-xl border ${isSuper ? 'border-warning/40 bg-warning/10/40' : 'border-border bg-surface'} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        {r.primaryPhotoKey ? (
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-teal/20 grid place-items-center shrink-0 text-primary font-bold">
            {initial}
          </div>
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted grid place-items-center shrink-0 text-muted-foreground font-bold">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/profiles/${r.profileId}`}
              className="text-sm font-semibold text-foreground hover:text-teal transition-colors truncate"
            >
              {r.name ?? `Profile ${r.profileId.slice(0, 6)}`}
            </Link>
            {r.isVerified && (
              <Verified className="h-4 w-4 text-success shrink-0" aria-label="Verified" />
            )}
            {isSuper && (
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning shrink-0 flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-amber-500 text-warning" /> SUPER
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {[r.age && `${r.age}y`, r.city].filter(Boolean).join(' · ') || 'Profile details hidden'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
            {lastActive && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <p className="text-xs text-success flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> {lastActive}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More actions"
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
              />
              <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onReport(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Flag className="h-3.5 w-3.5" /> Report profile
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onBlock(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-destructive flex items-center gap-2"
                >
                  <ShieldX className="h-3.5 w-3.5" /> Block
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {r.message && (
        <p className="text-sm text-foreground italic border-l-2 border-gold pl-3 line-clamp-3">
          “{r.message}”
        </p>
      )}

      {r.acceptanceMessage && r.status === 'ACCEPTED' && side === 'sent' && (
        <p className="text-xs text-success bg-success/10 rounded-lg px-3 py-2 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="italic">“{r.acceptanceMessage}”</span>
        </p>
      )}

      {expires && (
        <p className={`text-xs flex items-center gap-1 ${expires === 'expired' ? 'text-destructive' : 'text-warning'}`}>
          <Clock className="h-3 w-3" /> {expires}
        </p>
      )}

      {side === 'sent' && r.seenAt && r.status === 'PENDING' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCheck className="h-3 w-3" /> Seen {timeAgo(r.seenAt)}
        </p>
      )}

      {side === 'received' && r.status === 'PENDING' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="flex-1 bg-success text-white text-sm font-semibold rounded-lg py-2.5 min-h-[44px] hover:bg-success transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Heart className="h-4 w-4 fill-white" /> Accept
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="flex-1 border border-border text-muted-foreground text-sm font-semibold rounded-lg py-2.5 min-h-[44px] hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {side === 'sent' && r.status === 'PENDING' && (
        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          className="w-full border border-border text-muted-foreground text-sm font-medium rounded-lg py-2 min-h-[44px] hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-50"
        >
          Withdraw interest
        </button>
      )}

      {r.status === 'ACCEPTED' && (
        <Link
          href={`/chats?match=${r.id}`}
          className="block text-center w-full rounded-lg bg-teal text-white text-sm font-semibold py-2.5 hover:bg-teal-hover min-h-[44px] flex items-center justify-center gap-1.5"
        >
          <Heart className="h-4 w-4 fill-white" /> Open chat
        </Link>
      )}
    </div>
  );
}

export default function RequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<EnrichedMatchRequest[]>([]);
  const [sent,     setSent]     = useState<EnrichedMatchRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busyIds,  setBusyIds]  = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const [acceptModal,  setAcceptModal]  = useState<EnrichedMatchRequest | null>(null);
  const [declineModal, setDeclineModal] = useState<EnrichedMatchRequest | null>(null);
  const [reportModal,  setReportModal]  = useState<EnrichedMatchRequest | null>(null);

  const setBusy = (id: string, on: boolean) => setBusyIds((s) => {
    const n = new Set(s);
    if (on) n.add(id); else n.delete(id);
    return n;
  });

  const flashError = (id: string, msg: string) => {
    setActionError((e) => ({ ...e, [id]: msg }));
    setTimeout(() => setActionError((e) => { const n = { ...e }; delete n[id]; return n; }), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, sRes] = await Promise.all([
        apiFetch('/api/v1/matchmaking/requests/enriched?side=received&limit=100'),
        apiFetch('/api/v1/matchmaking/requests/enriched?side=sent&limit=100'),
      ]);
      if (rRes.status === 401 || sRes.status === 401) { router.push('/login'); return; }
      const [rJson, sJson] = await Promise.all([rRes.json(), sRes.json()]);
      const rData = (rJson as { success: boolean; data: { requests: EnrichedMatchRequest[] } }).data?.requests ?? [];
      const sData = (sJson as { success: boolean; data: { requests: EnrichedMatchRequest[] } }).data?.requests ?? [];
      setReceived(rData);
      setSent(sData);

      // Mark visible PENDING received requests as seen
      const unseen = rData.filter((x) => x.status === 'PENDING' && !x.seenAt);
      void Promise.all(
        unseen.map((x) => apiFetch(`/api/v1/matchmaking/requests/${x.id}/seen`, { method: 'PUT' })),
      );
    } catch {
      setError('Failed to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function handleAccept(r: EnrichedMatchRequest, welcomeMessage: string | null) {
    setBusy(r.id, true);
    const prev = received;
    setReceived((rs) => rs.map((x) => x.id === r.id ? { ...x, status: 'ACCEPTED' as const, acceptanceMessage: welcomeMessage } : x));
    try {
      const res = await apiFetch(`/api/v1/matchmaking/requests/${r.id}/accept`, {
        method: 'PUT',
        body: JSON.stringify({ welcomeMessage }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setReceived(prev);
      flashError(r.id, 'Could not accept — please try again');
    } finally { setBusy(r.id, false); }
  }

  async function handleDecline(r: EnrichedMatchRequest, reason: string | null) {
    setBusy(r.id, true);
    const prev = received;
    setReceived((rs) => rs.map((x) => x.id === r.id ? { ...x, status: 'DECLINED' as const, declineReason: reason } : x));
    try {
      const res = await apiFetch(`/api/v1/matchmaking/requests/${r.id}/decline`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setReceived(prev);
      flashError(r.id, 'Could not decline — please try again');
    } finally { setBusy(r.id, false); }
  }

  async function handleWithdraw(r: EnrichedMatchRequest) {
    if (!confirm('Withdraw this interest? The other person will not be notified unless they had already seen it.')) return;
    setBusy(r.id, true);
    const prev = sent;
    setSent((s) => s.map((x) => x.id === r.id ? { ...x, status: 'WITHDRAWN' as const } : x));
    try {
      const res = await apiFetch(`/api/v1/matchmaking/requests/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setSent(prev);
      flashError(r.id, 'Could not withdraw — please try again');
    } finally { setBusy(r.id, false); }
  }

  async function handleBlock(r: EnrichedMatchRequest) {
    if (!confirm(`Block ${r.name ?? 'this profile'}? They will no longer be able to contact you and any open match will be cancelled.`)) return;
    setBusy(r.id, true);
    try {
      const res = await apiFetch(`/api/v1/matchmaking/block/${r.profileId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed');
      // Refresh both lists since block flips both directions
      await load();
    } catch {
      flashError(r.id, 'Could not block — please try again');
    } finally { setBusy(r.id, false); }
  }

  async function handleReport(r: EnrichedMatchRequest, category: string, details: string | null) {
    setBusy(r.id, true);
    try {
      const res = await apiFetch(`/api/v1/matchmaking/report/${r.profileId}`, {
        method: 'POST',
        body: JSON.stringify({ category, details, requestId: r.id }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      flashError(r.id, 'Could not submit report — please try again');
    } finally { setBusy(r.id, false); }
  }

  const pendingReceived = received.filter((r) => r.status === 'PENDING');
  const pastReceived    = received.filter((r) => r.status !== 'PENDING');
  const pendingSent     = sent.filter((r) => r.status === 'PENDING');
  const pastSent        = sent.filter((r) => r.status !== 'PENDING');

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-primary font-heading">Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your match interests</p>
        </div>

        <div className="flex rounded-lg bg-surface border border-border p-1 gap-1">
          {(['received', 'sent'] as const).map((t) => {
            const count = t === 'received' ? pendingReceived.length : pendingSent.length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[44px] ${
                  tab === t ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'received' ? 'Received' : 'Sent'}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === t ? 'bg-surface/20' : 'bg-primary/10 text-primary'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-center justify-between">
            {error}
            <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        )}

        {!loading && tab === 'received' && (
          <div className="space-y-3">
            {pendingReceived.length === 0 && pastReceived.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No requests received yet. Explore profiles to get noticed!
              </div>
            )}

            {pendingReceived.map((r) => (
              <div key={r.id}>
                <RequestCard
                  r={r}
                  side="received"
                  busy={busyIds.has(r.id)}
                  onAccept={() => setAcceptModal(r)}
                  onDecline={() => setDeclineModal(r)}
                  onWithdraw={() => {}}
                  onBlock={() => void handleBlock(r)}
                  onReport={() => setReportModal(r)}
                />
                {actionError[r.id] && (
                  <p className="text-xs text-destructive mt-1 px-1">{actionError[r.id]}</p>
                )}
              </div>
            ))}

            {pastReceived.length > 0 && (
              <details className="group">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer py-2 list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  Past requests ({pastReceived.length})
                </summary>
                <div className="space-y-2 mt-2">
                  {pastReceived.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE['EXPIRED']!;
                    return (
                      <Link
                        key={r.id}
                        href={`/profiles/${r.profileId}`}
                        className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center gap-3 opacity-70 hover:opacity-100"
                      >
                        <div className="text-sm text-foreground flex-1 min-w-0 truncate">
                          {r.name ?? `Profile ${r.profileId.slice(0, 6)}`}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        {!loading && tab === 'sent' && (
          <div className="space-y-3">
            {pendingSent.length === 0 && pastSent.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                You haven’t sent any interests yet.{' '}
                <Link href="/feed" className="text-teal font-semibold">Browse profiles →</Link>
              </div>
            )}

            {pendingSent.map((r) => (
              <div key={r.id}>
                <RequestCard
                  r={r}
                  side="sent"
                  busy={busyIds.has(r.id)}
                  onAccept={() => {}}
                  onDecline={() => {}}
                  onWithdraw={() => void handleWithdraw(r)}
                  onBlock={() => void handleBlock(r)}
                  onReport={() => setReportModal(r)}
                />
                {actionError[r.id] && (
                  <p className="text-xs text-destructive mt-1 px-1">{actionError[r.id]}</p>
                )}
              </div>
            ))}

            {pastSent.length > 0 && (
              <details className="group">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer py-2 list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  Past requests ({pastSent.length})
                </summary>
                <div className="space-y-2 mt-2">
                  {pastSent.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE['EXPIRED']!;
                    return (
                      <Link
                        key={r.id}
                        href={`/profiles/${r.profileId}`}
                        className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center gap-3 opacity-70 hover:opacity-100"
                      >
                        <div className="text-sm text-foreground flex-1 min-w-0 truncate">
                          {r.name ?? `Profile ${r.profileId.slice(0, 6)}`}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <AcceptModal
        open={!!acceptModal}
        counterpartyName={acceptModal?.name ?? null}
        onClose={() => setAcceptModal(null)}
        onConfirm={async (msg) => { if (acceptModal) await handleAccept(acceptModal, msg); }}
      />
      <DeclineModal
        open={!!declineModal}
        onClose={() => setDeclineModal(null)}
        onConfirm={async (reason) => { if (declineModal) await handleDecline(declineModal, reason); }}
      />
      <ReportModal
        open={!!reportModal}
        onClose={() => setReportModal(null)}
        onConfirm={async (cat, det) => { if (reportModal) await handleReport(reportModal, cat, det); }}
      />
    </main>
  );
}
