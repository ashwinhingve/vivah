'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
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
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-auto sm:bottom-3">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg backdrop-blur-md',
              t.variant === 'success' && 'border-success/30 bg-success/10/95 text-success',
              t.variant === 'error'   && 'border-rose-200 bg-rose-50/95 text-rose-800',
              t.variant === 'info'    && 'border-gold/30 bg-surface/95 text-foreground',
            )}
          >
            {t.variant === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> :
             t.variant === 'error'   ? <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" /> : null}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-current opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
