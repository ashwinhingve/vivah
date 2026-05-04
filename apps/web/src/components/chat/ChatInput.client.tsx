'use client'

import {
  useCallback, useEffect, useRef, useState,
  type RefObject,
} from 'react'
import type { Socket } from 'socket.io-client'
import { ImagePlus, Send, Loader2, X, Smile } from 'lucide-react'
import type { ChatMessage } from '@smartshaadi/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import VoiceRecorder from './VoiceRecorder.client'
import SmartReplies from './SmartReplies.client'

interface ChatInputProps {
  matchId:          string
  socketRef:        RefObject<Socket | null>
  reply:            ChatMessage | null
  editing:          ChatMessage | null
  onCancelReply:    () => void
  onCancelEdit:     () => void
  smartReplyKey:    number
  onOptimisticSend?: (partial: {
    content: string
    type:    'TEXT' | 'PHOTO' | 'VOICE'
    photoKey?: string | null
    voiceKey?: string | null
    voiceDuration?: number | null
  }) => string | null
}

const QUICK_EMOJIS = ['😊', '😂', '❤️', '🙏', '👍', '🎉', '🔥', '😍']

export default function ChatInput({
  matchId, socketRef,
  reply, editing, onCancelReply, onCancelEdit, smartReplyKey, onOptimisticSend,
}: ChatInputProps) {
  const [content, setContent] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [showSmartReplies, setShowSmartReplies] = useState(true)
  const { toast } = useToast()

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync content when entering edit mode
  useEffect(() => {
    if (editing) {
      setContent(editing.content)
      textareaRef.current?.focus()
    }
  }, [editing])

  // Hide smart replies when user starts typing or replying
  useEffect(() => {
    setShowSmartReplies(content.trim().length === 0 && !reply && !editing)
  }, [content, reply, editing])

  const emitTyping = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
    typingDebounceRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { matchRequestId: matchId })
    }, 500)
  }, [matchId, socketRef])

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    emitTyping()
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 24 * 5 + 16)}px`
    }
  }

  const sendOrEdit = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed || !socketRef.current) return

    if (editing) {
      socketRef.current.emit('edit_message', {
        matchRequestId: matchId, messageId: editing._id, content: trimmed,
      })
      onCancelEdit()
    } else {
      onOptimisticSend?.({ content: trimmed, type: 'TEXT' })
      socketRef.current.emit('send_message', {
        matchRequestId: matchId,
        content: trimmed,
        type: 'TEXT',
        replyToId: reply ? reply._id : undefined,
      })
      if (reply) onCancelReply()
    }
    setContent('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [content, editing, reply, matchId, onCancelEdit, onCancelReply, socketRef])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendOrEdit()
    } else if (e.key === 'Escape') {
      if (editing) onCancelEdit()
      else if (reply) onCancelReply()
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !socketRef.current || isUploading) return
    if (file.size > 10 * 1024 * 1024) { toast('Image too large (max 10MB)', 'error'); return }
    setIsUploading(true)
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    try {
      const res = await fetch(`${apiUrl}/api/v1/chat/conversations/${matchId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      })
      const json = (await res.json()) as { success: boolean; data: { uploadUrl: string; key: string } }
      if (!json.success) { toast('Photo upload failed', 'error'); return }
      const putRes = await fetch(json.data.uploadUrl, {
        method: 'PUT', body: file, headers: { 'Content-Type': file.type },
      })
      if (!putRes.ok) { toast('Photo upload failed', 'error'); return }
      onOptimisticSend?.({ content: 'Photo', type: 'PHOTO', photoKey: json.data.key })
      socketRef.current.emit('send_message', {
        matchRequestId: matchId,
        content: 'Photo',
        type: 'PHOTO',
        photoKey: json.data.key,
        replyToId: reply ? reply._id : undefined,
      })
      if (reply) onCancelReply()
    } catch {
      toast('Photo upload failed', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleVoiceSent(key: string, durationSec: number) {
    onOptimisticSend?.({ content: 'Voice note', type: 'VOICE', voiceKey: key, voiceDuration: durationSec })
    socketRef.current?.emit('send_message', {
      matchRequestId: matchId,
      content: 'Voice note',
      type: 'VOICE',
      voiceKey: key,
      voiceDuration: durationSec,
      replyToId: reply ? reply._id : undefined,
    })
    if (reply) onCancelReply()
  }

  function insertEmoji(e: string) {
    const ta = textareaRef.current
    if (!ta) { setContent(content + e); return }
    const start = ta.selectionStart ?? content.length
    const end = ta.selectionEnd ?? content.length
    const next = content.slice(0, start) + e + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + e.length
    })
  }

  const canSend = !!content.trim()
  const isVoice = content.trim().length === 0 && !editing
  const placeholder = editing ? 'Edit your message…' : reply ? 'Reply…' : 'Type a message…'

  return (
    <div
      className="sticky bottom-0 z-10 border-t border-gold/20 bg-surface/95 px-3 py-2 backdrop-blur-xl"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <SmartReplies
        matchId={matchId}
        visible={showSmartReplies}
        onPick={(text) => { setContent(text); textareaRef.current?.focus() }}
        refreshKey={smartReplyKey}
      />

      {(reply || editing) ? (
        <div className="mb-2 flex items-stretch gap-2 rounded-lg border border-teal/30 bg-teal/5 px-2 py-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal">
              {editing ? 'Editing message' : 'Replying to'}
            </p>
            <p className="truncate text-xs text-foreground">
              {editing ? editing.content : reply?.type === 'PHOTO' ? '📷 Photo' : reply?.type === 'VOICE' ? '🎤 Voice note' : reply?.content}
            </p>
          </div>
          <button
            type="button"
            onClick={editing ? onCancelEdit : onCancelReply}
            aria-label="Cancel"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !!editing}
          aria-label={isUploading ? 'Uploading…' : 'Send photo'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-surface text-muted-foreground transition-all hover:border-gold hover:text-primary disabled:opacity-40"
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="min-h-[44px] w-full resize-none rounded-2xl border border-border bg-background py-2.5 pl-4 pr-10 text-sm leading-6 text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25"
            style={{ height: '44px' }}
          />
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label="Emoji"
            className="absolute right-2 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-primary"
          >
            <Smile className="h-4 w-4" />
          </button>
          {emojiOpen ? (
            <div
              role="menu"
              aria-label="Quick emoji"
              onMouseLeave={() => setEmojiOpen(false)}
              className="absolute bottom-12 right-0 z-30 flex gap-1 rounded-full border border-gold/30 bg-surface px-2 py-1.5 shadow-lg backdrop-blur"
            >
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { insertEmoji(e); setEmojiOpen(false) }}
                  aria-label={`Insert ${e}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg leading-none hover:bg-surface-muted"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isVoice ? (
          <VoiceRecorder matchId={matchId} onSent={handleVoiceSent} disabled={!!editing} />
        ) : (
          <button
            type="button"
            onClick={sendOrEdit}
            disabled={!canSend}
            aria-label={editing ? 'Save edit' : 'Send message'}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all',
              canSend
                ? 'bg-teal shadow-md shadow-teal/25 hover:-translate-y-0.5 hover:bg-teal-hover active:scale-95'
                : 'cursor-not-allowed bg-teal/40',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
