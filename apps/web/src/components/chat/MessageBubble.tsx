'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, CheckCheck, Clock, Forward, MoreHorizontal, Pencil, Video } from 'lucide-react'
import type { ChatMessage } from '@smartshaadi/types'
import { cn } from '@/lib/utils'
import { resolvePhotoUrl } from '@/lib/photo'
import { formatRelativeIN } from '@/lib/format'
import VoicePlayer from './VoicePlayer.client'
import ReactionStrip from './ReactionStrip'
import ReplyQuote from './ReplyQuote'
import LinkPreviewCard from './LinkPreviewCard'
import MessageMenu from './MessageMenu.client'
import ReactionPicker from './ReactionPicker.client'

const EDIT_WINDOW_MS = 15 * 60 * 1000
const DELETE_WINDOW_MS = 60 * 60 * 1000
const LONG_PRESS_MS = 350

interface MessageBubbleProps {
  message:           ChatMessage & { pending?: boolean; failed?: boolean }
  currentUserId:     string
  currentProfileId:  string | null
  otherFirstName?:   string | null
  highlight?:        boolean
  pending?:          boolean
  translatedContent?: string
  /** First bubble in a same-sender cluster — gets full top margin + meta row. */
  clusterFirst?:     boolean
  /** Last bubble in a same-sender cluster — gets the timestamp + tick row. */
  clusterLast?:      boolean
  onReply:           (m: ChatMessage) => void
  onReact:           (messageId: string, emoji: string) => void
  onUnreact:         (messageId: string, emoji: string) => void
  onEdit:            (m: ChatMessage) => void
  onDelete:          (messageId: string) => void
  onForward:         (m: ChatMessage) => void
  onCopy:            (m: ChatMessage) => void
  onPhotoTap?:       (photoKey: string) => void
}

const URL_RE = /(https?:\/\/[^\s]+)/i
const VIDEO_CALL_RE = /Video call started/i
const URL_EXTRACT_RE = /https?:\/\/\S+/i

function MessageBubbleInner({
  message, currentUserId, currentProfileId, otherFirstName, highlight, pending, translatedContent,
  clusterFirst = true, clusterLast = true,
  onReply, onReact, onUnreact, onEdit, onDelete, onForward, onCopy, onPhotoTap,
}: MessageBubbleProps) {
  const t = useTranslations('chat')
  const isSent = message.senderId === currentUserId || message.senderId === currentProfileId
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Time strings differ between server (UTC) and browser (IST) locales and
  // throw hydration mismatches — render them only after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const isDeleted = !!message.deletedAt
  const isPending = pending || message.pending

  if (message.type === 'SYSTEM') {
    if (VIDEO_CALL_RE.test(message.content)) {
      const urlMatch = message.content.match(URL_EXTRACT_RE)
      const joinUrl = urlMatch ? urlMatch[0] : null
      const rel = formatRelativeIN(message.sentAt)
      return (
        <div className="flex w-full justify-center py-1.5">
          <div className="flex max-w-[78%] items-center gap-3 rounded-2xl border border-gold/25 bg-gold/20 px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Video className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary leading-tight">{t('videoCall.started')}</p>
              {rel ? <p className="text-2xs text-gold-muted">{t('videoCall.startedAgo', { time: rel })}</p> : null}
            </div>
            {joinUrl ? (
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-lg bg-teal px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t('videoCall.joinCall')}
              </a>
            ) : null}
          </div>
        </div>
      )
    }
    // Defensive: strip any raw URLs from non-video SYSTEM messages
    const sanitized = message.content.replace(/https?:\/\/\S+/g, '').trim()
    return (
      <div className="flex w-full justify-center py-1">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-center text-xs italic text-muted-foreground">
          {sanitized || message.content.replace(/https?:\/\/\S+/g, '[link]')}
        </span>
      </div>
    )
  }

  const time = new Date(message.sentAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  const sentAtMs = new Date(message.sentAt).getTime()
  const ageMs = Date.now() - sentAtMs
  const canEdit = isSent && message.type === 'TEXT' && !isDeleted && ageMs < EDIT_WINDOW_MS && !isPending
  const canDelete = isSent && !isDeleted && ageMs < DELETE_WINDOW_MS && !isPending

  // 4-state delivery: ⏳ pending, ✓ sent, ✓✓ delivered, ✓✓ teal read
  let tick: React.ReactNode = null
  if (isSent && !isDeleted) {
    if (isPending) {
      tick = <Clock className="h-3 w-3 opacity-60" aria-label={t('status.sending')} />
    } else if (message.readAt || (message.readBy && message.readBy.some((id) => id !== message.senderId))) {
      tick = <CheckCheck className="h-3 w-3 text-teal" aria-label={t('status.read')} />
    } else if (message.deliveredTo && message.deliveredTo.some((id) => id !== message.senderId)) {
      tick = <CheckCheck className="h-3 w-3" aria-label={t('status.delivered')} />
    } else {
      tick = <Check className="h-3 w-3" aria-label={t('status.sent')} />
    }
  }

  function toggleReaction(emoji: string) {
    if (!currentProfileId || isPending) return
    const mine = message.reactions?.find((r) => r.profileId === currentProfileId && r.emoji === emoji)
    if (mine) onUnreact(message._id, emoji)
    else onReact(message._id, emoji)
  }

  function startLongPress() {
    if (isDeleted || isPending) return
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setMenuOpen(true)
      // Lightly vibrate on supported devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(15)
    }, LONG_PRESS_MS)
  }
  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        'group relative flex w-full',
        isSent ? 'justify-end' : 'justify-start',
        clusterFirst ? 'mt-3' : 'mt-0.5',
        highlight && 'rounded-2xl ring-2 ring-teal/60 transition-shadow',
        isPending && 'opacity-70',
      )}
      data-message-id={message._id}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onContextMenu={(e) => {
        if (isDeleted || isPending) return
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      <div className="relative flex max-w-[78%] flex-col">
        {message.forwardedFrom ? (
          <span className={cn(
            'mb-1 inline-flex items-center gap-1 text-2xs italic text-muted-foreground',
            isSent ? 'self-end' : 'self-start',
          )}>
            <Forward className="h-3 w-3" /> {t('forwarded')}
          </span>
        ) : null}

        {isDeleted ? (
          <div className={cn(
            'rounded-2xl px-4 py-2 text-sm italic shadow-sm',
            isSent
              ? 'rounded-br-md bg-teal/40 text-white/85'
              : 'rounded-bl-md border border-gold/20 bg-surface-muted text-muted-foreground',
          )}>
            {t('deleted')}
          </div>
        ) : message.type === 'PHOTO' && message.photoKey ? (
          <PhotoBubble
            photoKey={message.photoKey}
            isSent={isSent}
            replyTo={message.replyTo}
            currentProfileId={currentProfileId}
            otherFirstName={otherFirstName ?? null}
            onPhotoTap={onPhotoTap}
          />
        ) : message.type === 'VOICE' && message.voiceKey ? (
          <>
            {message.replyTo ? (
              <div className={cn('mb-1', isSent ? 'self-end' : 'self-start')}>
                <ReplyQuote reply={message.replyTo} currentProfileId={currentProfileId ?? ''} variant="bubble" otherName={otherFirstName ?? null} />
              </div>
            ) : null}
            <VoicePlayer
              voiceKey={message.voiceKey}
              durationSec={message.voiceDuration ?? 0}
              isSentByMe={isSent}
            />
          </>
        ) : (
          <div
            className={cn(
              'rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm',
              isSent
                ? 'rounded-br-md bg-teal text-white'
                : 'rounded-bl-md border border-gold/20 bg-surface text-foreground',
            )}
          >
            {message.replyTo ? (
              <ReplyQuote reply={message.replyTo} currentProfileId={currentProfileId ?? ''} variant="bubble" otherName={otherFirstName ?? null} />
            ) : null}
            <p className="break-words whitespace-pre-wrap">
              {renderTextWithLinks(translatedContent ?? message.content, isSent)}
            </p>
            {translatedContent ? (
              <span className={cn(
                'mt-1 inline-block rounded-full px-2 py-0.5 text-2xs font-medium',
                isSent ? 'bg-white/20 text-white/85' : 'bg-gold/20 text-gold-muted',
              )}>
                {t('translatedBadge')}
              </span>
            ) : null}
            {message.linkPreview ? (
              <LinkPreviewCard preview={message.linkPreview} isSentByMe={isSent} />
            ) : null}
          </div>
        )}

        {/* Hover actions (desktop) */}
        {!isDeleted && !isPending ? (
          <div
            className={cn(
              'absolute -top-3 z-10 hidden items-center gap-0.5 rounded-full border border-gold/30 bg-surface px-1 py-0.5 opacity-0 shadow-md transition-opacity sm:flex group-hover:opacity-100',
              isSent ? 'right-2' : 'left-2',
            )}
          >
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t('addReaction')}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-primary"
            >
              <span className="text-base leading-none">😊</span>
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onEdit(message)}
                aria-label={t('edit')}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-primary"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('more')}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-primary"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <ReactionPicker
          open={pickerOpen}
          align={isSent ? 'right' : 'left'}
          onPick={(emoji) => { toggleReaction(emoji); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
        <MessageMenu
          open={menuOpen}
          align={isSent ? 'right' : 'left'}
          canEdit={canEdit}
          canDelete={canDelete}
          onReply={() => onReply(message)}
          onReact={() => { setPickerOpen(true) }}
          onCopy={message.type === 'TEXT' ? () => onCopy(message) : undefined}
          onForward={() => onForward(message)}
          onEdit={canEdit ? () => onEdit(message) : undefined}
          onDelete={canDelete ? () => onDelete(message._id) : undefined}
          onClose={() => setMenuOpen(false)}
        />

        {message.reactions && message.reactions.length > 0 ? (
          <ReactionStrip
            reactions={message.reactions}
            currentProfileId={currentProfileId}
            isSentByMe={isSent}
            onToggle={(emoji) => toggleReaction(emoji)}
          />
        ) : null}

        {clusterLast ? (
          <span
            className={cn(
              'mt-1 inline-flex items-center gap-1 text-2xs text-muted-foreground',
              isSent ? 'self-end' : 'self-start',
            )}
          >
            {message.editedAt && !isDeleted ? <span className="italic">{t('edited')}</span> : null}
            {mounted ? time : ''}
            {tick}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function PhotoBubble({
  photoKey, isSent, replyTo, currentProfileId, otherFirstName, onPhotoTap,
}: {
  photoKey: string
  isSent: boolean
  replyTo: ChatMessage['replyTo']
  currentProfileId: string | null
  otherFirstName: string | null
  onPhotoTap?: (key: string) => void
}) {
  const photoUrl = resolvePhotoUrl(photoKey)
  if (!photoUrl) return null
  return (
    <>
      {replyTo ? (
        <div className={cn('mb-1', isSent ? 'self-end' : 'self-start')}>
          <ReplyQuote reply={replyTo} currentProfileId={currentProfileId ?? ''} variant="bubble" otherName={otherFirstName} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onPhotoTap?.(photoKey)}
        className={cn(
          'block overflow-hidden rounded-2xl shadow-sm transition-transform active:scale-[0.98]',
          isSent ? 'rounded-br-md' : 'rounded-bl-md border border-gold/20',
        )}
        aria-label="Open photo"
      >
        <Image src={photoUrl} alt="Shared photo" width={320} height={220} className="block max-w-full" />
      </button>
    </>
  )
}

function renderTextWithLinks(content: string, isSent: boolean): React.ReactNode {
  const parts = content.split(URL_RE)
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('underline underline-offset-2', isSent ? 'text-white' : 'text-teal')}
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default MessageBubbleInner
