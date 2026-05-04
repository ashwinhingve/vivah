'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import type { ChatMessage } from '@smartshaadi/types'
import { cn } from '@/lib/utils'

interface ChatSearchProps {
  open:        boolean
  matchId:     string
  onClose:     () => void
  onJumpTo:    (messageId: string) => void
}

export default function ChatSearch({ open, matchId, onClose, onJumpTo }: ChatSearchProps) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ChatMessage[]>([])
  const [active, setActive] = useState(0)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); return }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/chat/conversations/${matchId}/search?q=${encodeURIComponent(q)}`,
          { credentials: 'include' },
        )
        const j = (await res.json()) as { success: boolean; data: ChatMessage[] }
        setResults(j.success ? j.data : [])
        setActive(0)
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [q, matchId, open])

  if (!open) return null

  function step(delta: number) {
    if (results.length === 0) return
    const next = (active + delta + results.length) % results.length
    setActive(next)
    const m = results[next]
    if (m) onJumpTo(m._id)
  }

  return (
    <div className="sticky top-0 z-30 flex flex-col gap-2 border-b border-gold/20 bg-surface/95 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search this conversation"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
        {q ? (
          <span className={cn('text-xs', results.length === 0 ? 'text-muted-foreground' : 'text-teal font-semibold')}>
            {searching ? '…' : results.length === 0 ? '0' : `${active + 1}/${results.length}`}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={results.length === 0}
          aria-label="Previous match"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-background disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={results.length === 0}
          aria-label="Next match"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-background disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
