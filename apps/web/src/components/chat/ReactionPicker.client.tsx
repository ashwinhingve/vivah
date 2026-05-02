'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '🎉']

interface ReactionPickerProps {
  open:    boolean
  onPick:  (emoji: string) => void
  onClose: () => void
  align?:  'left' | 'right'
}

/**
 * Floating emoji picker shown above a message bubble after long-press.
 * Auto-dismisses on outside click or Escape.
 */
export default function ReactionPicker({
  open, onPick, onClose, align = 'left',
}: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Add reaction"
      className={cn(
        'absolute -top-12 z-20 flex gap-1 rounded-full bg-surface border border-gold/30 shadow-lg px-2 py-1.5 backdrop-blur',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`React with ${e}`}
          onClick={() => onPick(e)}
          className="text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-muted transition-colors"
        >
          {e}
        </button>
      ))}
    </div>
  )
}
