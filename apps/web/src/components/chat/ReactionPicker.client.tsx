'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
 * Supports keyboard navigation: ArrowLeft/Right, Home/End, Enter/Space to select.
 */
export default function ReactionPicker({
  open, onPick, onClose, align = 'left',
}: ReactionPickerProps) {
  const t = useTranslations('chat')
  const ref = useRef<HTMLDivElement | null>(null)
  const [focusIdx, setFocusIdx] = useState(0)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) {
      setFocusIdx(0)
      return
    }
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFocusIdx((i) => (i - 1 + REACTIONS.length) % REACTIONS.length)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFocusIdx((i) => (i + 1) % REACTIONS.length)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setFocusIdx(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setFocusIdx(REACTIONS.length - 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onPick(REACTIONS[focusIdx]!)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, onPick, focusIdx])

  useEffect(() => {
    if (open && buttonRefs.current[focusIdx]) {
      buttonRefs.current[focusIdx]?.focus()
    }
  }, [open, focusIdx])

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
      {REACTIONS.map((e, i) => (
        <button
          key={e}
          ref={(el) => { buttonRefs.current[i] = el }}
          type="button"
          aria-label={t('reactions.reactWith', { emoji: e })}
          onClick={() => onPick(e)}
          onKeyDown={(evt) => {
            if (evt.key === 'ArrowLeft') {
              evt.preventDefault()
              setFocusIdx((idx) => (idx - 1 + REACTIONS.length) % REACTIONS.length)
            } else if (evt.key === 'ArrowRight') {
              evt.preventDefault()
              setFocusIdx((idx) => (idx + 1) % REACTIONS.length)
            } else if (evt.key === 'Home') {
              evt.preventDefault()
              setFocusIdx(0)
            } else if (evt.key === 'End') {
              evt.preventDefault()
              setFocusIdx(REACTIONS.length - 1)
            }
          }}
          tabIndex={focusIdx === i ? 0 : -1}
          className={cn(
            'text-lg leading-none min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors',
            focusIdx === i ? 'bg-surface-muted' : 'hover:bg-surface-muted',
          )}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
