'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, Forward, Loader2 } from 'lucide-react'
import type { ChatMessage, ConversationParticipantPreview } from '@smartshaadi/types'
import { resolvePhotoUrl } from '@/lib/photo'
import { cn } from '@/lib/utils'

interface ForwardTarget {
  matchRequestId: string
  other:          ConversationParticipantPreview | null
  lastMessage:    string | null
  updatedAt:      string
}

interface ForwardPickerProps {
  message:        ChatMessage | null
  excludeMatchId: string
  onClose:        () => void
  onForwarded:    () => void
  onError:        () => void
}

export default function ForwardPicker({
  message, excludeMatchId, onClose, onForwarded, onError,
}: ForwardPickerProps) {
  const [targets, setTargets] = useState<ForwardTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    let cancelled = false
    setLoading(true)
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    fetch(`${apiUrl}/api/v1/chat/conversations/forward-targets?exclude=${excludeMatchId}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((j: { success: boolean; data: ForwardTarget[] }) => {
        if (cancelled) return
        if (j.success) setTargets(j.data ?? [])
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [message, excludeMatchId])

  useEffect(() => {
    if (!message) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [message, onClose])

  if (!message) return null

  async function forwardTo(t: ForwardTarget) {
    if (!message) return
    setSendingTo(t.matchRequestId)
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
      const res = await fetch(
        `${apiUrl}/api/v1/chat/conversations/${excludeMatchId}/forward`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            messageId:        message._id,
            toMatchRequestId: t.matchRequestId,
          }),
        },
      )
      const j = (await res.json()) as { success: boolean }
      if (j.success) onForwarded()
      else onError()
    } catch {
      onError()
    } finally {
      setSendingTo(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
        style={{ maxHeight: 'min(75vh, 600px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gold/20 px-4 py-3">
          <h2 className="font-heading text-base font-semibold text-[#0F172A]">Forward to…</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-gold/10 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Forwarding:</span>{' '}
          {message.type === 'PHOTO' ? '📷 Photo'
            : message.type === 'VOICE' ? '🎙️ Voice note'
            : message.content.slice(0, 80)}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : targets.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No other conversations to forward to yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {targets.map((t) => {
                const photoUrl = t.other?.primaryPhotoKey ? resolvePhotoUrl(t.other.primaryPhotoKey) : null
                const initial = t.other?.firstName?.[0]?.toUpperCase() ?? '?'
                const sending = sendingTo === t.matchRequestId
                return (
                  <li key={t.matchRequestId}>
                    <button
                      type="button"
                      onClick={() => forwardTo(t)}
                      disabled={sendingTo !== null}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted disabled:opacity-50',
                      )}
                    >
                      {photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.other?.firstName ?? 'Match'}
                          {t.other?.age ? <span className="text-muted-foreground"> · {t.other.age}</span> : null}
                        </p>
                        {t.lastMessage ? (
                          <p className="truncate text-xs text-muted-foreground">{t.lastMessage}</p>
                        ) : null}
                      </div>
                      {sending ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal" />
                      ) : (
                        <Forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
