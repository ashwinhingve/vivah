'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CoachSuggestion } from '@smartshaadi/types'
import { fetchCoachSuggestions } from '@/app/actions/ai'

interface SmartSuggestionsProps {
  matchId: string
  isOpen:  boolean
  onClose: () => void
}

const DISMISS_TTL_MS = 10 * 60 * 1000

function dismissKey(matchId: string): string {
  return `coach_dismissed_${matchId}`
}

function recentlyDismissed(matchId: string): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(dismissKey(matchId))
  if (!raw) return false
  const ts = Number.parseInt(raw, 10)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < DISMISS_TTL_MS
}

export default function SmartSuggestions({ matchId, isOpen, onClose }: SmartSuggestionsProps) {
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(false)
  const [suggestions, setSuggestions] = useState<CoachSuggestion[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetchCoachSuggestions(matchId)
      setSuggestions(res.suggestions)
    } catch {
      setError(true)
      setSuggestions(null)
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    if (!isOpen) return
    if (recentlyDismissed(matchId)) {
      onClose()
      return
    }
    void load()
  }, [isOpen, matchId, onClose, load])

  function handlePick(text: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('coach:populate', { detail: { matchId, text } }),
      )
    }
    onClose()
  }

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(dismissKey(matchId), String(Date.now()))
    }
    onClose()
  }

  if (!isOpen) return null
  if (recentlyDismissed(matchId)) return null

  // Graceful invisibility: empty / fallback success state renders nothing.
  if (!loading && !error && (!suggestions || suggestions.length === 0)) return null

  return (
    <div
      role="dialog"
      aria-label="Smart Suggestions"
      className="fixed inset-x-0 bottom-[88px] z-30 mx-auto max-w-2xl rounded-t-xl border-t border-gold/30 bg-surface p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="font-heading text-sm font-semibold text-primary">
          💡 Smart Suggestions
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss suggestions"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-11 flex-1 animate-pulse rounded-full bg-teal/20"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-primary">Couldn&rsquo;t load suggestions.</p>
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-primary/40 px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
          >
            Tap to retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {suggestions!.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handlePick(s.text)}
              title={s.reason}
              className="flex min-h-[44px] flex-1 cursor-pointer items-center rounded-full border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal transition-colors hover:bg-teal/20"
            >
              <span className="text-left">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
