'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ChatMessage } from '@smartshaadi/types'

interface ChatInputProps {
  matchId: string
  currentUserId: string
  authToken: string
  onMessageReceived?: (message: ChatMessage) => void
}

export default function ChatInput({
  matchId,
  currentUserId,
  authToken,
  onMessageReceived,
}: ChatInputProps) {
  const [content, setContent] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageReceivedRef = useRef(onMessageReceived)
  onMessageReceivedRef.current = onMessageReceived

  useEffect(() => {
    // Use the base server URL (no /api/v1) for Socket.io namespace connections
    const socketUrl = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000'
    const socket = io(`${socketUrl}/chat`, {
      auth: { token: authToken },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join_room', { matchRequestId: matchId })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('message_received', (message: ChatMessage) => {
      onMessageReceivedRef.current?.(message)
      // Auto-mark messages from others as read
      if (message.senderId !== currentUserId) {
        socket.emit('mark_read', { matchRequestId: matchId, messageIds: [message._id] })
      }
    })

    socket.on('user_typing', (data: { userId: string }) => {
      if (data.userId !== currentUserId) {
        setTypingUser(data.userId)
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 2000)
      }
    })

    socketRef.current = socket

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
      socket.disconnect()
    }
  }, [matchId, authToken, currentUserId])

  const emitTyping = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
    typingDebounceRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { matchRequestId: matchId })
    }, 500)
  }, [matchId])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    emitTyping()
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 24 * 4 + 16)}px`
    }
  }

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed || !socketRef.current) return
    socketRef.current.emit('send_message', {
      matchRequestId: matchId,
      content: trimmed,
      type: 'TEXT',
    })
    setContent('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !socketRef.current || isUploading) return
    setIsUploading(true)

    // API URL for REST calls (includes /api/v1 prefix)
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1'
    try {
      const res = await fetch(`${apiUrl}/chat/conversations/${matchId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      })
      const json = (await res.json()) as {
        success: boolean
        data: { uploadUrl: string; key: string }
      }
      if (!json.success) return

      await fetch(json.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      socketRef.current.emit('send_message', {
        matchRequestId: matchId,
        content: 'Photo',
        type: 'PHOTO',
        photoKey: json.data.key,
      })
    } catch {
      // Silent fail — user can retry
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-white border-t border-[#C5A47E]/20 px-4 py-3">
      {typingUser && (
        <p className="text-xs text-[#6B6B76] mb-1 pl-1">Someone is typing…</p>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label={isUploading ? 'Uploading…' : 'Send photo'}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#C5A47E]/30 text-[#6B6B76] hover:bg-[#FEFAF6] transition-colors shrink-0 disabled:opacity-40"
        >
          {isUploading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'Type a message…' : 'Connecting…'}
          disabled={!isConnected}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[#C5A47E]/30 bg-[#FEFAF6] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#6B6B76] focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/30 focus:border-[#0E7C7B] transition-colors min-h-[44px] leading-6 disabled:opacity-50"
          style={{ height: '44px' }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!content.trim() || !isConnected}
          aria-label="Send message"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#0E7C7B] text-white px-4 hover:bg-[#149998] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
