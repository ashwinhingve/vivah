'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Search, X } from 'lucide-react'
import type { ConversationListItem as ConvItem, MessageType } from '@smartshaadi/types'
import { useChatSocket } from '@/lib/socket/SocketProvider.client'
import ConversationListItem from './ConversationListItem'
import { EmptyState } from '@/components/ui/EmptyState'

interface ChatsListClientProps {
  initialItems:     ConvItem[]
  currentProfileId: string
  authToken:        string
}

interface ConvUpdatedPayload {
  matchRequestId: string
  kind:           'last_message' | 'unread_cleared'
  lastMessage?: {
    content:  string
    sentAt:   string
    senderId: string
    type:     MessageType
  }
}

function sortItems(items: ConvItem[]): ConvItem[] {
  return [...items].sort((a, b) => {
    if (a.settings.pinned !== b.settings.pinned) return a.settings.pinned ? -1 : 1
    const at = new Date(a.lastMessage?.sentAt ?? a.updatedAt).getTime()
    const bt = new Date(b.lastMessage?.sentAt ?? b.updatedAt).getTime()
    return bt - at
  })
}

export default function ChatsListClient({
  initialItems, currentProfileId, authToken,
}: ChatsListClientProps) {
  const t = useTranslations('chats')
  const [items, setItems] = useState<ConvItem[]>(sortItems(initialItems))
  const [query, setQuery] = useState('')
  const contextSocket = useChatSocket()
  const ownSocketRef = useRef<Socket | null>(null)

  useEffect(() => { setItems(sortItems(initialItems)) }, [initialItems])

  useEffect(() => {
    const socket: Socket = contextSocket ?? (() => {
      const url = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
      const s = io(`${url}/chat`, {
        auth:       { token: authToken },
        transports: ['websocket'],
      })
      ownSocketRef.current = s
      return s
    })()

    function onConversationUpdated(p: ConvUpdatedPayload) {
      setItems((prev) => {
        const next = prev.slice()
        const idx = next.findIndex((c) => c.matchRequestId === p.matchRequestId)
        if (idx < 0) return prev

        const cur = next[idx]
        if (!cur) return prev

        if (p.kind === 'last_message' && p.lastMessage) {
          const isMine = p.lastMessage.senderId === currentProfileId
          next[idx] = {
            ...cur,
            lastMessage: p.lastMessage,
            unreadCount: isMine ? cur.unreadCount : cur.unreadCount + 1,
            updatedAt:   p.lastMessage.sentAt,
          }
        } else if (p.kind === 'unread_cleared') {
          next[idx] = { ...cur, unreadCount: 0 }
        }
        return sortItems(next)
      })
    }

    function onPresenceUpdate(p: { profileId: string; isOnline: boolean; lastSeenAt: string | null }) {
      setItems((prev) => prev.map((c) => {
        if (!c.other || c.other.profileId !== p.profileId) return c
        return { ...c, other: { ...c.other, isOnline: p.isOnline, lastSeenAt: p.lastSeenAt } }
      }))
    }

    socket.on('conversation_updated', onConversationUpdated)
    socket.on('presence_update', onPresenceUpdate)

    return () => {
      socket.off('conversation_updated', onConversationUpdated)
      socket.off('presence_update', onPresenceUpdate)
      if (ownSocketRef.current) {
        ownSocketRef.current.disconnect()
        ownSocketRef.current = null
      }
    }
  }, [contextSocket, authToken, currentProfileId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const name = item.other?.firstName?.toLowerCase() ?? ''
      const last = item.lastMessage?.content?.toLowerCase() ?? ''
      return name.includes(q) || last.includes(q)
    })
  }, [items, query])

  if (items.length === 0) {
    return (
      <EmptyState
        variant="no-messages"
        actionLabel={t('findMatches')}
        actionHref="/feed"
      />
    )
  }

  return (
    <>
      <div className="border-b border-gold/15 bg-surface px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border border-gold/20 bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            aria-label={t('searchPlaceholder')}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-surface-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t('noMatch', { query })}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((item) => (
            <li key={item.matchRequestId}>
              <ConversationListItem item={item} currentProfileId={currentProfileId} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
