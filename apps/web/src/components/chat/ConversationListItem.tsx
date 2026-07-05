'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { BellOff, Pin, Image as ImageIcon, Mic, Video } from 'lucide-react'
import type { ConversationListItem as ConvItem } from '@smartshaadi/types'
import { resolvePhotoUrl } from '@/lib/photo'
import { cn } from '@/lib/utils'
import { ImageWithFallback } from '@/components/ui/ImageWithFallback.client'

interface Props {
  item:             ConvItem
  currentProfileId: string
}

function formatTs(iso: string | null | undefined, locale: string, yesterdayLabel: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const intlLocale = locale === 'hi' ? 'hi-IN' : 'en-IN'
  const numFmt = { numberingSystem: 'latn' } as Intl.DateTimeFormatOptions
  if (sameDay) {
    return d.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: true, ...numFmt })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 1) return yesterdayLabel
  if (diffDays < 7) return d.toLocaleDateString(intlLocale, { weekday: 'short', ...numFmt })
  return d.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', ...numFmt })
}

const VIDEO_CALL_RE = /Video call started/i

export default function ConversationListItem({ item, currentProfileId }: Props) {
  const t = useTranslations('chats')
  const locale = useLocale()
  const other = item.other
  const photoUrl = other?.primaryPhotoKey ? resolvePhotoUrl(other.primaryPhotoKey) : null
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
      preview = t('previewPhoto').replace('📷 ', '')
      previewIcon = 'photo'
    } else if (item.lastMessage.type === 'VOICE') {
      preview = t('previewVoiceNote')
      previewIcon = 'voice'
    } else if (item.lastMessage.type === 'SYSTEM') {
      if (VIDEO_CALL_RE.test(item.lastMessage.content)) {
        preview = t('previewVideoCall')
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
        <ImageWithFallback
          src={photoUrl}
          alt={other?.firstName ?? t('fallbackName')}
          name={other?.firstName ?? ''}
          width={48}
          height={48}
          wrapperClassName="h-12 w-12 rounded-full"
        />
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
            {other?.firstName ?? t('fallbackName')}
            {other?.age ? <span className="text-muted-foreground"> · {other.age}</span> : null}
          </p>
          {pinned ? <Pin className="h-3 w-3 shrink-0 text-teal" /> : null}
          {muted ? <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
          <span className={cn(
            'ml-auto shrink-0 text-[11px]',
            isUnread ? 'font-semibold text-teal' : 'text-muted-foreground',
          )}>
            {formatTs(item.lastMessage?.sentAt ?? item.updatedAt, locale, t('yesterday'))}
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
            {isMine ? <span className="text-gold-muted">{t('youPrefix')}</span> : null}
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
