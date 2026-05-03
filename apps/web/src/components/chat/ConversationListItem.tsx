import Image from 'next/image'
import Link from 'next/link'
import { BellOff, Pin, Image as ImageIcon, Mic } from 'lucide-react'
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

export default function ConversationListItem({ item, currentProfileId }: Props) {
  const other = item.other
  const photoUrl = other?.primaryPhotoKey ? resolvePhotoUrl(other.primaryPhotoKey) : null
  const initial = other?.firstName?.[0]?.toUpperCase() ?? '?'
  const isMine = item.lastMessage?.senderId === currentProfileId
  const isUnread = item.unreadCount > 0 && !isMine
  const muted = !!item.settings.mutedUntil
  const pinned = item.settings.pinned

  let preview = '—'
  if (item.lastMessage) {
    if (item.lastMessage.type === 'PHOTO') preview = '📷 Photo'
    else if (item.lastMessage.type === 'VOICE') preview = '🎤 Voice note'
    else if (item.lastMessage.type === 'SYSTEM') preview = item.lastMessage.content
    else preview = item.lastMessage.content
  }

  return (
    <Link
      href={`/chat/${item.matchRequestId}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted active:bg-surface-muted/70',
        isUnread && 'bg-teal/[0.03]',
      )}
    >
      <div className="relative shrink-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={other?.firstName ?? 'Match'}
            width={52}
            height={52}
            className="h-[52px] w-[52px] rounded-full object-cover"
          />
        ) : (
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-teal/10 text-base font-semibold text-teal">
            {initial}
          </div>
        )}
        {other?.isOnline ? (
          <span
            aria-label="Online"
            className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-success"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            'truncate font-heading text-sm',
            isUnread ? 'font-semibold text-[#0F172A]' : 'font-medium text-foreground',
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
          {item.lastMessage?.type === 'PHOTO' ? (
            <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : item.lastMessage?.type === 'VOICE' ? (
            <Mic className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : null}
          <p className={cn(
            'truncate text-xs',
            isUnread ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {isMine ? <span className="text-muted-foreground">You: </span> : null}
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
