'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { SmartReplySuggestion } from '@smartshaadi/types'
import { cn } from '@/lib/utils'

interface SmartRepliesProps {
  matchId:    string
  visible:    boolean
  onPick:     (text: string) => void
  refreshKey: number
}

const TONE_COLORS: Record<SmartReplySuggestion['tone'], string> = {
  warm:     'border-rose-300/50 bg-rose-50 text-rose-700 hover:bg-rose-100',
  curious:  'border-warning/40/50 bg-warning/10 text-warning hover:bg-warning/15',
  friendly: 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/15',
  safe:     'border-border bg-surface-muted text-foreground hover:bg-surface',
}

export default function SmartReplies({ matchId, visible, onPick, refreshKey }: SmartRepliesProps) {
  const [items, setItems] = useState<SmartReplySuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    fetch(`${apiUrl}/api/v1/chat/conversations/${matchId}/smart-replies`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((j: { success: boolean; data: SmartReplySuggestion[] }) => {
        if (cancelled) return
        if (j.success) setItems(Array.isArray(j.data) ? j.data : [])
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchId, visible, refreshKey])

  if (!visible || (!loading && items.length === 0)) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 pl-1 -mx-1 px-1 no-scrollbar">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
      {loading && items.length === 0 ? (
        <span className="text-xs text-muted-foreground">Thinking…</span>
      ) : (
        items.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(s.text)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors',
              TONE_COLORS[s.tone],
            )}
          >
            {s.text}
          </button>
        ))
      )}
    </div>
  )
}
