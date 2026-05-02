'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ConversationListItem as ConvItem, MessageType } from '@smartshaadi/types'
import { useChatSocket } from '@/lib/socket/SocketProvider.client'
import ConversationListItem from './ConversationListItem'

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
  const [items, setItems] = useState<ConvItem[]>(sortItems(initialItems))
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

  if (items.length === 0) return null

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.matchRequestId}>
          <ConversationListItem item={item} currentProfileId={currentProfileId} />
        </li>
      ))}
    </ul>
  )
}
