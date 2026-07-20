'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImageWithFallback } from '@/components/ui/ImageWithFallback.client'
import { Link } from '@/i18n/navigation';
import {
  ArrowLeft, MoreVertical, Search as SearchIcon, BellOff, Bell,
  Archive, ArchiveRestore, ImageIcon, Flag, Ban, Pin, PinOff, Lightbulb, Video,
} from 'lucide-react'
import type { ConversationParticipantPreview } from '@smartshaadi/types'
import { resolvePhotoUrl } from '@/lib/photo'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import SmartSuggestions from './SmartSuggestions.client'
import EmotionalScoreBadge from './EmotionalScoreBadge.client'

interface ChatHeaderProps {
  matchId:        string
  initialOther:   ConversationParticipantPreview | null
  onSearchToggle: () => void
  onMediaToggle:  () => void
  presence?:      { isOnline: boolean; lastSeenAt: string | null } | null
  initialMuted?:  boolean
  initialArchived?: boolean
  initialPinned?: boolean
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Offline'
  const t = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function ChatHeader({
  matchId, initialOther, onSearchToggle, onMediaToggle, presence,
  initialMuted = false, initialArchived = false, initialPinned = false,
}: ChatHeaderProps) {
  const t = useTranslations('chat')
  const [menuOpen, setMenuOpen] = useState(false)
  const [muted, setMuted] = useState(initialMuted)
  const [archived, setArchived] = useState(initialArchived)
  const [pinned, setPinned] = useState(initialPinned)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | { kind: 'report' | 'block' }>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setMuted(initialMuted) }, [initialMuted])
  useEffect(() => { setArchived(initialArchived) }, [initialArchived])
  useEffect(() => { setPinned(initialPinned) }, [initialPinned])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = () => setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const photoUrl = initialOther?.primaryPhotoKey ? resolvePhotoUrl(initialOther.primaryPhotoKey) : null
  const isOnline = presence?.isOnline ?? initialOther?.isOnline ?? false
  const lastSeenAt = presence?.lastSeenAt ?? initialOther?.lastSeenAt ?? null

  const subtitle = isOnline
    ? t('presence.online')
    : mounted && lastSeenAt ? t('presence.lastSeen', { time: formatLastSeen(lastSeenAt) }) : mounted ? t('presence.offline') : '—'

  async function patchSettings(body: Record<string, unknown>): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
      const res = await fetch(`${apiUrl}/api/v1/chat/conversations/${matchId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      return res.ok
    } catch {
      return false
    } finally {
      setBusy(false)
      setMenuOpen(false)
    }
  }

  async function toggleMute() {
    const next = !muted
    setMuted(next)
    const ok = await patchSettings({ muted: next })
    if (!ok) { setMuted(!next); toast('Could not update mute', 'error'); return }
    toast(next ? 'Notifications muted' : 'Notifications unmuted', 'success')
  }
  async function toggleArchive() {
    const next = !archived
    setArchived(next)
    const ok = await patchSettings({ archived: next })
    if (!ok) { setArchived(!next); toast('Could not update archive', 'error'); return }
    toast(next ? 'Conversation archived' : 'Conversation unarchived', 'success')
  }
  async function togglePin() {
    const next = !pinned
    setPinned(next)
    const ok = await patchSettings({ pinned: next })
    if (!ok) { setPinned(!next); toast('Could not update pin', 'error'); return }
    toast(next ? 'Pinned to top' : 'Unpinned', 'success')
  }
  async function reportUser() {
    setConfirm(null)
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    try {
      const res = await fetch(`${apiUrl}/api/v1/chat/conversations/${matchId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'inappropriate' }),
      })
      if (res.ok) toast('Reported. Our team will review.', 'success')
      else toast('Could not submit report', 'error')
    } catch {
      toast('Could not submit report', 'error')
    }
  }
  async function blockUser() {
    setConfirm(null)
    if (!initialOther?.profileId) { toast('Cannot block right now', 'error'); return }
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    try {
      const res = await fetch(`${apiUrl}/api/v1/matchmaking/block/${initialOther.profileId}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        toast('User blocked. Returning to chats.', 'success')
        setTimeout(() => { window.location.href = '/chats' }, 800)
      } else {
        toast('Block failed — try the profile page', 'error')
      }
    } catch {
      toast('Block failed', 'error')
    }
  }

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-gold/20 bg-surface/95 px-3 py-2.5 backdrop-blur-xl">
      <Link
        href="/chats"
        aria-label="Back to chats"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background -ml-1"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <Link
        href={initialOther?.profileId ? `/profiles/${initialOther.profileId}` : '#'}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label="View profile"
      >
        <div className="relative shrink-0">
          <ImageWithFallback
            src={photoUrl}
            alt={initialOther?.firstName ?? 'Participant'}
            name={initialOther?.firstName}
            fill
            sizes="40px"
            wrapperClassName="h-10 w-10 rounded-full"
          />
          <span
            aria-label={isOnline ? 'Online' : 'Offline'}
            className={cn(
              'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface',
              isOnline ? 'bg-success' : 'bg-muted-foreground/40',
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-foreground">
            {initialOther?.firstName ?? 'Match'}
            {initialOther?.age ? <span className="font-normal text-muted-foreground"> · {initialOther.age}</span> : null}
          </p>
          <p className={cn('truncate text-2xs', isOnline ? 'text-success' : 'text-muted-foreground')}>
            {subtitle}
            {initialOther?.city ? ` · ${initialOther.city}` : ''}
          </p>
        </div>
      </Link>

      <EmotionalScoreBadge matchId={matchId} />

      <button
        type="button"
        onClick={onSearchToggle}
        aria-label="Search in conversation"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => { window.dispatchEvent(new CustomEvent('chat:toggle-video')) }}
        aria-label="Video call"
        title="Video call"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-teal transition-colors hover:bg-teal/10"
      >
        <Video className="h-5 w-5" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
          aria-label="Conversation options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-xl border border-gold/30 bg-surface shadow-xl"
          >
            <MenuItem
              icon={<ImageIcon className="h-4 w-4" />}
              label={t('menu.mediaFiles')}
              onClick={() => { onMediaToggle(); setMenuOpen(false) }}
            />
            <MenuItem
              icon={<Lightbulb className="h-4 w-4" />}
              label={t('menu.aiCoach')}
              onClick={() => { setShowSuggestions(true); setMenuOpen(false) }}
            />
            <MenuItem
              icon={pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              label={pinned ? t('menu.unpinChat') : t('menu.pinChat')}
              onClick={togglePin}
            />
            <MenuItem
              icon={muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              label={muted ? t('menu.unmuteNotifications') : t('menu.muteNotifications')}
              onClick={toggleMute}
            />
            <MenuItem
              icon={archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              label={archived ? t('menu.unarchiveChat') : t('menu.archiveChat')}
              onClick={toggleArchive}
            />
            <MenuItem
              icon={<Flag className="h-4 w-4" />}
              label={t('menu.report')}
              danger
              onClick={() => { setMenuOpen(false); setConfirm({ kind: 'report' }) }}
            />
            <MenuItem
              icon={<Ban className="h-4 w-4" />}
              label={t('menu.blockAndExit')}
              danger
              onClick={() => { setMenuOpen(false); setConfirm({ kind: 'block' }) }}
            />
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm?.kind === 'report'}
        title="Report this conversation?"
        description="Our trust & safety team will review. You won’t be notified of the outcome."
        confirmLabel="Report"
        destructive
        onConfirm={reportUser}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'block'}
        title={`Block ${initialOther?.firstName ?? 'this user'}?`}
        description="They will not be able to message you again. The match will be ended."
        confirmLabel="Block"
        destructive
        onConfirm={blockUser}
        onCancel={() => setConfirm(null)}
      />

      <SmartSuggestions
        matchId={matchId}
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
      />
    </header>
  )
}

function MenuItem({
  icon, label, danger, onClick,
}: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted',
        danger ? 'text-destructive' : 'text-foreground',
      )}
    >
      <span className={cn('shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
