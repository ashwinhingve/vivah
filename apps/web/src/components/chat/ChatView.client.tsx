'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Loader2 } from 'lucide-react'
import type {
  ChatMessage,
  ConversationParticipantPreview,
  MessageReaction,
} from '@smartshaadi/types'
import type { Socket } from 'socket.io-client'
import { useChatSocket } from '@/lib/socket/SocketProvider.client'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput.client'
import ChatHeader from './ChatHeader.client'
import ChatSearch from './ChatSearch.client'
import MediaGallery from './MediaGallery.client'
import DateSeparator from './DateSeparator'
import ForwardPicker from './ForwardPicker.client'
import PhotoLightbox from './PhotoLightbox.client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type OptimisticMessage = ChatMessage & {
  clientMsgId?: string
  pending?:    boolean
  failed?:     boolean
}

interface ChatViewProps {
  matchId:          string
  currentUserId:    string
  currentProfileId: string | null
  authToken:        string
  initialMessages:  ChatMessage[]
  initialOther:     ConversationParticipantPreview | null
  initialSettings?: {
    muted:     boolean
    archived:  boolean
    pinned:    boolean
    wallpaper: string | null
  }
  initialHasMore?: boolean
  initialTotal?:   number
}

const PAGE_SIZE = 50

export default function ChatView({
  matchId, currentUserId, currentProfileId, authToken: _authToken,
  initialMessages, initialOther, initialSettings, initialHasMore, initialTotal,
}: ChatViewProps) {
  const [messages, setMessages] = useState<OptimisticMessage[]>(initialMessages)
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [presence, setPresence] = useState<{ isOnline: boolean; lastSeenAt: string | null } | null>(
    initialOther ? { isOnline: initialOther.isOnline, lastSeenAt: initialOther.lastSeenAt } : null,
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [scrollPinned, setScrollPinned] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [smartReplyKey, setSmartReplyKey] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore ?? (initialTotal ?? 0) > initialMessages.length)
  const [cursor, setCursor] = useState<string | null>(
    initialMessages.length > 0 ? (initialMessages[0]?._id ?? null) : null,
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [lightboxKey, setLightboxKey] = useState<string | null>(null)

  const contextSocket = useChatSocket()
  const socketRef = useRef<Socket | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const topSentinelRef = useRef<HTMLDivElement | null>(null)
  void topSentinelRef
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optimisticByClient = useRef<Map<string, OptimisticMessage>>(new Map())

  const { toast } = useToast()

  // ── Socket lifecycle ──
  useEffect(() => {
    const socket = contextSocket
    if (!socket) return

    socketRef.current = socket

    const onConnect = (): void => {
      socket?.emit('join_room', { matchRequestId: matchId })
    }

    if (socket.connected) {
      socket.emit('join_room', { matchRequestId: matchId })
    }
    socket.on('connect', onConnect)

    socket.on('message_received', (m: ChatMessage) => {
      setMessages((prev) => {
        // Reconcile optimistic message by clientMsgId match (sent by self)
        if (m.senderId === currentProfileId) {
          const idx = prev.findIndex((x) =>
            x.pending && x.senderId === m.senderId && x.content === m.content && x.type === m.type,
          )
          if (idx >= 0) {
            const next = prev.slice()
            const old = next[idx]!
            const cid = old.clientMsgId
            if (cid) optimisticByClient.current.delete(cid)
            next[idx] = { ...m, pending: false, failed: false } as OptimisticMessage
            return next
          }
        }
        if (prev.some((x) => x._id === m._id)) return prev
        return [...prev, m]
      })

      if (m.senderId !== currentUserId && m.senderId !== currentProfileId) {
        socket.emit('delivered_ack', { matchRequestId: matchId, messageIds: [m._id] })
        socket.emit('mark_read', { matchRequestId: matchId, messageIds: [m._id] })
        setSmartReplyKey((k) => k + 1)
      }
    })

    socket.on('message_edited', ({ messageId, content, editedAt }: { messageId: string; content: string; editedAt: string }) => {
      setMessages((prev) => prev.map((x) =>
        x._id === messageId ? { ...x, content, editedAt } : x,
      ))
    })

    socket.on('message_deleted', ({ messageId, deletedAt }: { messageId: string; deletedAt: string }) => {
      setMessages((prev) => prev.map((x) =>
        x._id === messageId ? { ...x, content: '[deleted]', deletedAt, linkPreview: null } : x,
      ))
    })

    socket.on('message_reacted', ({ messageId, reactions }: { messageId: string; reactions: MessageReaction[] }) => {
      setMessages((prev) => prev.map((x) =>
        x._id === messageId ? { ...x, reactions } : x,
      ))
    })

    socket.on('message_delivered', ({ messageIds, profileId }: { messageIds: string[]; profileId: string }) => {
      setMessages((prev) => prev.map((x) =>
        messageIds.includes(x._id)
          ? { ...x, deliveredTo: x.deliveredTo.includes(profileId) ? x.deliveredTo : [...x.deliveredTo, profileId] }
          : x,
      ))
    })

    socket.on('message_read', ({ messageIds, readBy, readAt }: { messageIds: string[]; readBy: string; readAt?: string }) => {
      const at = readAt ?? new Date().toISOString()
      setMessages((prev) => prev.map((x) =>
        messageIds.includes(x._id)
          ? {
              ...x,
              readAt: at,
              readBy: x.readBy.includes(readBy) ? x.readBy : [...x.readBy, readBy],
            }
          : x,
      ))
    })

    socket.on('user_typing', (data: { userId?: string; profileId?: string }) => {
      const id = data.userId ?? data.profileId ?? null
      if (id && id !== currentUserId && id !== currentProfileId) {
        setTypingUser(id)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTypingUser(null), 2500)
      }
    })

    socket.on('presence_update', (p: { profileId: string; isOnline: boolean; lastSeenAt: string | null }) => {
      if (initialOther && p.profileId === initialOther.profileId) {
        setPresence({ isOnline: p.isOnline, lastSeenAt: p.lastSeenAt })
      }
    })

    socket.on('error', (e: { message?: string }) => {
      if (e?.message) toast(e.message, 'error')
    })

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      socket.off('connect', onConnect)
      socket.off('message_received')
      socket.off('message_edited')
      socket.off('message_deleted')
      socket.off('message_reacted')
      socket.off('message_delivered')
      socket.off('message_read')
      socket.off('user_typing')
      socket.off('presence_update')
      socket.off('error')
      socket.emit('leave_room', { matchRequestId: matchId })
      socketRef.current = null
    }
  }, [contextSocket, matchId, currentUserId, currentProfileId, initialOther, toast])

  // ── Mark unread initial messages as read on mount ──
  useEffect(() => {
    if (!currentProfileId) return
    const unread = initialMessages
      .filter((m) => m.senderId !== currentProfileId && !m.readBy.includes(currentProfileId))
      .map((m) => m._id)
    if (unread.length === 0) return
    const tm = setTimeout(() => {
      socketRef.current?.emit('mark_read', { matchRequestId: matchId, messageIds: unread })
      socketRef.current?.emit('delivered_ack', { matchRequestId: matchId, messageIds: unread })
    }, 250)
    return () => clearTimeout(tm)
  }, [matchId, initialMessages, currentProfileId])

  // ── Auto-scroll ──
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (scrollPinned) scrollToBottom(true)
    else setUnreadCount((n) => n + 1)
  }, [messages.length, scrollPinned, scrollToBottom])

  useEffect(() => { scrollToBottom(false) }, [scrollToBottom])

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setScrollPinned(nearBottom)
    if (nearBottom) setUnreadCount(0)

    if (el.scrollTop < 120 && hasMore && !loadingMore) {
      void loadOlder()
    }
  }

  // ── Infinite scroll: load older messages via cursor pagination ──
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const el = scrollerRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0
    const prevScrollTop = el?.scrollTop ?? 0
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
      const url = cursor
        ? `${apiUrl}/api/v1/chat/conversations/${matchId}?before=${encodeURIComponent(cursor)}&limit=${PAGE_SIZE}`
        : `${apiUrl}/api/v1/chat/conversations/${matchId}?page=${page + 1}&limit=${PAGE_SIZE}`
      const res = await fetch(url, { credentials: 'include' })
      const j = await res.json() as {
        success: boolean
        data: { messages: ChatMessage[]; total: number; hasMore?: boolean }
      }
      if (!j.success) return
      const older = j.data.messages.slice().reverse()
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m._id))
        const merged = older.filter((m) => !seen.has(m._id))
        if (merged.length > 0) {
          setCursor(merged[0]!._id)
        }
        return [...merged, ...prev]
      })
      if (!cursor) setPage((p) => p + 1)
      setHasMore(j.data.hasMore ?? older.length === PAGE_SIZE)
      // Restore scroll anchor to keep visual position stable
      requestAnimationFrame(() => {
        const e2 = scrollerRef.current
        if (!e2) return
        e2.scrollTop = prevScrollTop + (e2.scrollHeight - prevScrollHeight)
      })
    } catch {
      /* silent */
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, cursor, page, matchId])

  // ── Group messages with DateSeparator ──
  const grouped = useMemo(() => {
    const out: { type: 'date' | 'msg'; key: string; msg?: OptimisticMessage; iso?: string }[] = []
    let lastDay = ''
    for (const m of messages) {
      const day = new Date(m.sentAt).toDateString()
      if (day !== lastDay) {
        out.push({ type: 'date', key: `d-${day}`, iso: m.sentAt })
        lastDay = day
      }
      out.push({ type: 'msg', key: m.clientMsgId ?? m._id, msg: m })
    }
    return out
  }, [messages])

  // ── Optimistic helpers ──
  const pushOptimistic = useCallback((partial: {
    content: string
    type:    'TEXT' | 'PHOTO' | 'VOICE'
    photoKey?: string | null
    voiceKey?: string | null
    voiceDuration?: number | null
  }) => {
    if (!currentProfileId) return null
    const clientMsgId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const opt: OptimisticMessage = {
      _id:           clientMsgId,
      clientMsgId,
      senderId:      currentProfileId,
      content:       partial.content,
      contentHi:     null,
      contentEn:     null,
      type:          partial.type,
      photoKey:      partial.photoKey ?? null,
      voiceKey:      partial.voiceKey ?? null,
      voiceDuration: partial.voiceDuration ?? null,
      sentAt:        new Date().toISOString(),
      readAt:        null,
      readBy:        [],
      deliveredTo:   [],
      reactions:     [],
      replyTo:       reply ? {
        messageId: reply._id,
        senderId:  reply.senderId,
        type:      reply.type,
        preview:   reply.type === 'PHOTO' ? '📷 Photo' : reply.type === 'VOICE' ? '🎙️ Voice note' : reply.content.slice(0, 80),
      } : null,
      forwardedFrom: null,
      linkPreview:   null,
      editedAt:      null,
      deletedAt:     null,
      pending:       true,
    }
    optimisticByClient.current.set(clientMsgId, opt)
    setMessages((prev) => [...prev, opt])
    return clientMsgId
  }, [currentProfileId, reply])

  // ── Action handlers wired to socket ──
  const onReply = useCallback((m: ChatMessage) => { setReply(m); setEditing(null) }, [])
  const onCancelReply = useCallback(() => setReply(null), [])
  const onEditStart = useCallback((m: ChatMessage) => { setEditing(m); setReply(null) }, [])
  const onCancelEdit = useCallback(() => setEditing(null), [])

  const onReact = useCallback((messageId: string, emoji: string) => {
    if (currentProfileId) {
      setMessages((prev) => prev.map((x) => {
        if (x._id !== messageId) return x
        const others = x.reactions.filter((r) => r.profileId !== currentProfileId)
        return { ...x, reactions: [...others, { profileId: currentProfileId, emoji, at: new Date().toISOString() }] }
      }))
    }
    socketRef.current?.emit('react_message', { matchRequestId: matchId, messageId, emoji })
  }, [matchId, currentProfileId])

  const onUnreact = useCallback((messageId: string, emoji: string) => {
    if (currentProfileId) {
      setMessages((prev) => prev.map((x) => {
        if (x._id !== messageId) return x
        return { ...x, reactions: x.reactions.filter((r) => !(r.profileId === currentProfileId && r.emoji === emoji)) }
      }))
    }
    socketRef.current?.emit('unreact_message', { matchRequestId: matchId, messageId, emoji })
  }, [matchId, currentProfileId])

  const onDelete = useCallback((messageId: string) => {
    setConfirmDelete(messageId)
  }, [])

  const confirmDeleteNow = useCallback(() => {
    const id = confirmDelete
    if (!id) return
    setMessages((prev) => prev.map((x) =>
      x._id === id ? { ...x, content: '[deleted]', deletedAt: new Date().toISOString(), linkPreview: null } : x,
    ))
    socketRef.current?.emit('delete_message', { matchRequestId: matchId, messageId: id })
    setConfirmDelete(null)
  }, [confirmDelete, matchId])

  const onForward = useCallback((m: ChatMessage) => {
    setForwardTarget(m)
  }, [])

  const onCopy = useCallback((m: ChatMessage) => {
    navigator.clipboard?.writeText(m.content)
      .then(() => toast('Copied to clipboard', 'success'))
      .catch(() => toast('Could not copy', 'error'))
  }, [toast])

  const onPhotoTap = useCallback((photoKey: string) => {
    setLightboxKey(photoKey)
  }, [])

  function jumpToMessage(messageId: string) {
    const node = scrollerRef.current?.querySelector(`[data-message-id="${messageId}"]`)
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(messageId)
      setTimeout(() => setHighlightId(null), 1600)
    } else {
      toast('Older message — scroll up to load history', 'info')
    }
  }

  const otherProfileId = initialOther?.profileId ?? null
  const photoKeys = useMemo(
    () => messages.filter((m) => m.type === 'PHOTO' && m.photoKey).map((m) => m.photoKey as string),
    [messages],
  )

  return (
    <>
      <ChatHeader
        matchId={matchId}
        initialOther={initialOther}
        presence={presence}
        onSearchToggle={() => setSearchOpen((o) => !o)}
        onMediaToggle={() => setGalleryOpen(true)}
        initialMuted={initialSettings?.muted ?? false}
        initialArchived={initialSettings?.archived ?? false}
        initialPinned={initialSettings?.pinned ?? false}
      />
      <ChatSearch
        open={searchOpen}
        matchId={matchId}
        onClose={() => setSearchOpen(false)}
        onJumpTo={jumpToMessage}
      />
      <MediaGallery
        open={galleryOpen}
        matchId={matchId}
        onClose={() => setGalleryOpen(false)}
        onPhotoTap={onPhotoTap}
      />

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto px-4 py-4 space-y-2 overscroll-contain"
        style={{
          // Account for sticky header + iOS safe area
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {loadingMore ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!hasMore && messages.length > PAGE_SIZE ? (
          <p className="text-center text-[11px] text-muted-foreground py-2">Beginning of conversation</p>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-3xl">💬</div>
            <p className="font-heading text-base font-semibold text-[#0F172A]">Start the conversation</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Say hello and begin your journey together
            </p>
          </div>
        ) : (
          grouped.map((g) =>
            g.type === 'date' ? (
              <DateSeparator key={g.key} iso={g.iso ?? new Date().toISOString()} />
            ) : (
              <MessageBubble
                key={g.key}
                message={g.msg!}
                currentUserId={currentUserId}
                currentProfileId={currentProfileId}
                otherFirstName={initialOther?.firstName ?? null}
                highlight={highlightId === g.msg!._id}
                pending={g.msg!.pending}
                onReply={onReply}
                onReact={onReact}
                onUnreact={onUnreact}
                onEdit={onEditStart}
                onDelete={onDelete}
                onForward={onForward}
                onCopy={onCopy}
                onPhotoTap={onPhotoTap}
              />
            ),
          )
        )}

        {typingUser ? (
          <div className="pl-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs italic text-muted-foreground">
              <TypingDots />
              {initialOther?.firstName ? `${initialOther.firstName} is typing` : 'typing'}
            </span>
          </div>
        ) : null}
      </div>

      {!scrollPinned ? (
        <button
          type="button"
          onClick={() => { scrollToBottom(true); setUnreadCount(0); setScrollPinned(true) }}
          aria-label="Jump to latest"
          className={cn(
            'absolute bottom-24 right-5 z-20 flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-teal/30 transition-transform hover:-translate-y-0.5',
          )}
        >
          {unreadCount > 0 ? `${unreadCount} new` : null}
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <ChatInput
        matchId={matchId}
        socketRef={socketRef}
        reply={reply}
        editing={editing}
        onCancelReply={onCancelReply}
        onCancelEdit={onCancelEdit}
        smartReplyKey={smartReplyKey}
        onOptimisticSend={pushOptimistic}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this message?"
        description="The message will be marked as deleted for everyone in the conversation."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteNow}
        onCancel={() => setConfirmDelete(null)}
      />
      <ForwardPicker
        message={forwardTarget}
        excludeMatchId={matchId}
        onClose={() => setForwardTarget(null)}
        onForwarded={() => { setForwardTarget(null); toast('Message forwarded', 'success') }}
        onError={() => { setForwardTarget(null); toast('Forward failed', 'error') }}
      />
      <PhotoLightbox
        keys={photoKeys}
        activeKey={lightboxKey}
        onClose={() => setLightboxKey(null)}
      />

      {/* otherProfileId reserved for future per-other state */}
      {otherProfileId ? null : null}
    </>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex h-2 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 animate-pulse rounded-full bg-teal"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}
