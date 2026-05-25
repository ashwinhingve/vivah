'use client'

import { useEffect, useState } from 'react'
import { X, Video } from 'lucide-react'
import { VideoCall } from './VideoCall.client'

interface VideoCallPanelProps {
  matchId:        string
  currentUserId:  string
}

const STORAGE_KEY = 'chat:videocall-open'

/**
 * Video-call section for a chat. Day 10: no longer self-mounted as a
 * prominent banner above the chat — toggled by the Video icon in
 * ChatHeader via the global `chat:toggle-video` custom event. Renders
 * nothing when closed.
 */
export default function VideoCallPanel({ matchId, currentUserId }: VideoCallPanelProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === '1') setOpen(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0') } catch { /* ignore */ }
  }, [open])

  useEffect(() => {
    const onToggle = () => setOpen((o) => !o)
    window.addEventListener('chat:toggle-video', onToggle)
    return () => window.removeEventListener('chat:toggle-video', onToggle)
  }, [])

  if (!open) return null

  return (
    <section className="border-b border-gold/20 bg-surface/95 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <Video className="h-4 w-4 text-teal" aria-hidden="true" />
          Video call
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close video panel"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <VideoCall matchId={matchId} currentUserId={currentUserId} />
    </section>
  )
}
