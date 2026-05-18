'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id:      string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      toast: (m: string) => { if (typeof console !== 'undefined') console.warn('[toast]', m) },
    }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const tm = timersRef.current.get(id)
    if (tm) { clearTimeout(tm); timersRef.current.delete(id) }
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setItems((prev) => [...prev, { id, message, variant }])
    const tm = setTimeout(() => dismiss(id), 4000)
    timersRef.current.set(id, tm)
  }, [dismiss])

  useEffect(() => () => {
    for (const tm of timersRef.current.values()) clearTimeout(tm)
    timersRef.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end sm:px-0">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border bg-surface px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur-md',
              t.variant === 'success' && 'border-success/30',
              t.variant === 'error'   && 'border-destructive/40',
              t.variant === 'info'    && 'border-gold/40',
            )}
          >
            <span className="mt-px shrink-0">
              {t.variant === 'success' ? <CheckCircle2 className="h-[18px] w-[18px] text-success" aria-hidden="true" /> :
               t.variant === 'error'   ? <AlertCircle className="h-[18px] w-[18px] text-destructive" aria-hidden="true" /> :
                                         <Info className="h-[18px] w-[18px] text-gold-muted" aria-hidden="true" />}
            </span>
            <span className="flex-1 pt-0.5 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-2 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
