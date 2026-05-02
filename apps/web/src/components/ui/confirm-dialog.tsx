'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open:        boolean
  title:       string
  description?: string
  confirmLabel?: string
  cancelLabel?:  string
  destructive?: boolean
  onConfirm:   () => void
  onCancel:    () => void
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive, onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter')  onConfirm()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onCancel, onConfirm])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-base font-semibold text-[#0F172A]">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={cn(
              'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors',
              destructive ? 'bg-destructive hover:bg-destructive/90' : 'bg-teal hover:bg-teal-hover',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
