'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VideoCall } from './VideoCall.client'

interface VideoCallPanelProps {
  matchId:        string
  currentUserId:  string
}

const STORAGE_KEY = 'chat:videocall-open'

export default function VideoCallPanel({ matchId, currentUserId }: VideoCallPanelProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === '1') setOpen(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0') } catch { /* ignore */ }
  }, [open])

  // Lightweight badge of PROPOSED meetings without mounting full VideoCall.
  useEffect(() => {
    let cancelled = false
    const apiUrl = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000'
    fetch(`${apiUrl}/api/v1/video/meetings/${matchId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { success: boolean; data: Array<{ status: string }> }) => {
        if (cancelled || !j.success) return
        setPending(j.data.filter((m) => m.status === 'PROPOSED').length)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [matchId])

  return (
    <section
      className={cn(
        'border-b border-gold/20 bg-surface/95 backdrop-blur-xl',
        open ? '' : '',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-background/40"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/10 text-teal">
          <Video className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-[#0F172A]">Video calls</span>
          <span className="block text-[11px] text-muted-foreground">
            Start an instant call or schedule one together
          </span>
        </span>
        {pending > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            {pending} pending
          </span>
        ) : null}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open ? <VideoCall matchId={matchId} currentUserId={currentUserId} /> : null}
    </section>
  )
}
