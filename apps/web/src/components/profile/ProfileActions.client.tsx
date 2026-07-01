'use client';
/**
 * ProfileActions
 *
 * Sticky action bar rendered on the profile detail page for non-self viewers.
 *
 * Layout:
 *  - Mobile: fixed bottom bar (above nav)
 *  - Desktop: inline at the bottom of the right column
 *
 * Buttons:
 *  - Shortlist (heart): toggles filled/ghost with optimistic UI
 *    TODO: wire to POST /api/v1/matchmaking/shortlist/:profileId once endpoint exists
 *  - Connect/Message/Accept/Pending: delegates to MatchActionBar logic
 *  - More (kebab): dropdown with Report / Block / Share
 *    Block: wired to POST /api/v1/matchmaking/block/:profileId (P1-12 closed)
 *    TODO: wire Report to POST /api/v1/profiles/:profileId/report (no endpoint yet)
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { Heart, MoreHorizontal, Flag, ShieldOff, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type MatchStatus = 'none' | 'sent_pending' | 'received_pending' | 'matched';
type InternalStatus = MatchStatus | 'sending' | 'declined' | 'error';

interface Props {
  profileId: string;
  displayName: string;
  initialStatus: MatchStatus;
  requestId: string | null;
  /** Render inline (desktop right-col) vs fixed sticky (mobile) */
  sticky?: boolean;
}

function useClickOutside(ref: { current: HTMLElement | null }, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

function KebabMenu({
  profileId,
  displayName,
  onClose,
}: {
  profileId: string;
  displayName: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('profileDetail');
  const [blocking, setBlocking] = useState(false);
  useClickOutside(ref, onClose);

  async function handleBlock() {
    if (blocking) return;
    if (!window.confirm(t('actions.blockConfirm', { name: displayName }))) {
      return;
    }
    setBlocking(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/block/${profileId}`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({}),
      });
      if (res.ok) {
        toast(t('actions.blocked'), 'success');
        onClose();
        router.replace('/feed');
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        toast(body.error?.message ?? t('actions.blockFailed'), 'error');
      }
    } catch {
      toast(t('actions.networkError'), 'error');
    } finally {
      setBlocking(false);
    }
  }

  async function handleShare() {
    if (typeof window !== 'undefined' && navigator.share) {
      await navigator.share({
        title: `${displayName} on Smart Shaadi`,
        url: window.location.href,
      }).catch(() => {/* cancelled */});
    } else if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href).catch(() => {/* ignore */});
    }
    onClose();
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-gold/20 bg-surface shadow-card overflow-hidden z-50"
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          // TODO: wire to POST /api/v1/profiles/:profileId/report
          //       (re-add `profileId` prop to KebabMenu when the endpoint exists)
          onClose();
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-destructive/5 hover:text-destructive transition-colors"
      >
        <Flag className="w-4 h-4" aria-hidden="true" />
        {t('actions.report')}
      </button>
      <div className="h-px bg-border-light mx-3" />
      <button
        type="button"
        role="menuitem"
        disabled={blocking}
        onClick={() => { void handleBlock(); }}
        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-destructive/5 hover:text-destructive transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {blocking ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <ShieldOff className="w-4 h-4" aria-hidden="true" />
        )}
        {blocking ? t('actions.blocking') : t('actions.block')}
      </button>
      <div className="h-px bg-border-light mx-3" />
      <button
        type="button"
        role="menuitem"
        onClick={() => { void handleShare(); }}
        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/30 transition-colors"
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
        {t('actions.share')}
      </button>
    </div>
  );
}

function ConnectButton({
  status,
  requestId,
  onSend,
  onAccept,
}: {
  status: InternalStatus;
  requestId: string | null;
  onSend: () => void;
  onAccept: () => void;
}) {
  const t = useTranslations('profileDetail');

  if (status === 'matched' && requestId) {
    return (
      <Link
        href={`/chat/${requestId}`}
        className="flex-1 h-11 rounded-lg bg-teal text-white font-semibold text-sm flex items-center justify-center hover:bg-teal-hover transition-colors"
      >
        {t('actions.message')}
      </Link>
    );
  }

  if (status === 'received_pending') {
    return (
      <button
        type="button"
        onClick={onAccept}
        className="flex-1 h-11 rounded-lg bg-success text-white font-semibold text-sm flex items-center justify-center hover:bg-success/90 transition-colors"
      >
        {t('actions.accept')}
      </button>
    );
  }

  if (status === 'sent_pending') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 h-11 rounded-lg bg-success/15 text-success font-semibold text-sm flex items-center justify-center cursor-not-allowed"
      >
        {t('actions.pending')}
      </button>
    );
  }

  if (status === 'sending') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 h-11 rounded-lg bg-teal/50 text-white font-semibold text-sm flex items-center justify-center cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
        {t('actions.pleaseWait')}
      </button>
    );
  }

  if (status === 'declined') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 h-11 rounded-lg bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center cursor-not-allowed"
      >
        {t('actions.declined')}
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onSend}
        className="flex-1 h-11 rounded-lg border-2 border-destructive text-destructive font-semibold text-sm flex items-center justify-center hover:bg-destructive/5 transition-colors"
      >
        {t('actions.tryAgain')}
      </button>
    );
  }

  // status === 'none'
  return (
    <button
      type="button"
      onClick={onSend}
      className="flex-1 h-11 rounded-lg bg-teal text-white font-semibold text-sm flex items-center justify-center hover:bg-teal-hover transition-colors shadow-sm"
    >
      {t('actions.connect')}
    </button>
  );
}

export function ProfileActions({
  profileId,
  displayName,
  initialStatus,
  requestId,
  sticky = true,
}: Props) {
  const [status, setStatus] = useState<InternalStatus>(initialStatus);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(requestId);
  const [shortlisted, setShortlisted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const t = useTranslations('profileDetail');

  async function sendInterest() {
    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: profileId }),
      });
      const json = (await res.json()) as { data?: { id?: string } };
      if (res.ok) setActiveRequestId(json.data?.id ?? null);
      if (res.ok || res.status === 409) { setStatus('sent_pending'); return; }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  async function acceptInterest() {
    if (!activeRequestId) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests/${activeRequestId}/accept`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (res.ok) { router.push(`/chat/${activeRequestId}`); return; }
      setStatus('received_pending');
    } catch {
      setStatus('received_pending');
    }
  }

  function toggleShortlist() {
    // Optimistic toggle
    // TODO: wire to POST/DELETE /api/v1/matchmaking/shortlist/:profileId once endpoint exists
    setShortlisted((v) => !v);
  }

  const inner = (
    <div className="flex items-center gap-2.5">
      {/* Shortlist (heart) */}
      <button
        type="button"
        aria-label={shortlisted ? t('actions.removeShortlist') : t('actions.addShortlist')}
        onClick={toggleShortlist}
        className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
          shortlisted
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gold/30 text-muted-foreground hover:border-primary hover:text-primary'
        }`}
      >
        <Heart
          className="w-5 h-5"
          fill={shortlisted ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>

      {/* Connect / Message / Accept */}
      <ConnectButton
        status={status}
        requestId={activeRequestId}
        onSend={() => { void sendInterest(); }}
        onAccept={() => { void acceptInterest(); }}
      />

      {/* More kebab */}
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={t('actions.more')}
          onClick={() => setShowMenu((v) => !v)}
          className="w-11 h-11 rounded-lg border border-gold/30 flex items-center justify-center text-muted-foreground hover:border-gold hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
        </button>
        {showMenu && (
          <KebabMenu
            profileId={profileId}
            displayName={displayName}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>
    </div>
  );

  if (!sticky) {
    return <div className="pt-2">{inner}</div>;
  }

  // Mobile sticky
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-gold/20 px-4 py-3 shadow-2xl md:hidden">
      <div className="mx-auto max-w-lg">
        {inner}
      </div>
    </div>
  );
}
