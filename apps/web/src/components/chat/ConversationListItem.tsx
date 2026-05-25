'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { BellOff, Pin, Image as ImageIcon, Mic, Video } from 'lucide-react'
import type { ConversationListItem as ConvItem } from '@smartshaadi/types'
import { resolvePhotoUrl } from '@/lib/photo'
import { cn } from '@/lib/utils'

interface Props {
  item:             ConvItem
  currentProfileId: string
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' })
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const VIDEO_CALL_RE = /Video call started/i

export default function ConversationListItem({ item, currentProfileId }: Props) {
  const other = item.other
  const photoUrl = other?.primaryPhotoKey ? resolvePhotoUrl(other.primaryPhotoKey) : null
  const initial = (other?.firstName?.[0] ?? '?').toUpperCase()
  const isMine = item.lastMessage?.senderId === currentProfileId
  const isUnread = item.unreadCount > 0 && !isMine
  const muted = !!item.settings.mutedUntil
  const pinned = item.settings.pinned

  const pathname = usePathname()
  const isActive = pathname?.startsWith(`/chat/${item.matchRequestId}`) ?? false

  let preview = '—'
  let previewIcon: 'photo' | 'voice' | 'video' | null = null
  if (item.lastMessage) {
    if (item.lastMessage.type === 'PHOTO') {
      preview = 'Photo'
      previewIcon = 'photo'
    } else if (item.lastMessage.type === 'VOICE') {
      preview = 'Voice note'
      previewIcon = 'voice'
    } else if (item.lastMessage.type === 'SYSTEM') {
      if (VIDEO_CALL_RE.test(item.lastMessage.content)) {
        preview = 'Video call'
        previewIcon = 'video'
      } else {
        preview = item.lastMessage.content
      }
    } else {
      preview = item.lastMessage.content
    }
  }

  return (
    <Link
      href={`/chat/${item.matchRequestId}`}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted active:bg-surface-muted/70',
        isUnread && !isActive && 'bg-teal/[0.03]',
        isActive && 'bg-background',
      )}
    >
      {isActive && (
        <span
          className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-teal"
          aria-hidden="true"
        />
      )}

      <div className="relative shrink-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={other?.firstName ?? 'Match'}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 font-heading text-lg font-semibold text-primary">
            {initial}
          </div>
        )}
        {other?.isOnline ? (
          <span
            aria-label="Online"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            'truncate text-sm',
            isUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground',
          )}>
            {other?.firstName ?? 'Match'}
            {other?.age ? <span className="text-muted-foreground"> · {other.age}</span> : null}
          </p>
          {pinned ? <Pin className="h-3 w-3 shrink-0 text-teal" /> : null}
          {muted ? <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
          <span className={cn(
            'ml-auto shrink-0 text-[11px]',
            isUnread ? 'font-semibold text-teal' : 'text-muted-foreground',
          )}>
            {formatTs(item.lastMessage?.sentAt ?? item.updatedAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {previewIcon === 'photo' && <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {previewIcon === 'voice' && <Mic className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {previewIcon === 'video' && <Video className="h-3 w-3 shrink-0 text-teal" />}
          <p className={cn(
            'truncate text-xs',
            isUnread ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {isMine ? <span className="text-gold-muted">You: </span> : null}
            {preview}
          </p>
          {isUnread ? (
            <span className="ml-auto inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-teal px-1.5 text-[10px] font-semibold text-white">
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
