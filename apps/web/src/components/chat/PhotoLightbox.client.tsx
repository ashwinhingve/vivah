'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { resolvePhotoUrl } from '@/lib/photo'

interface PhotoLightboxProps {
  keys:      string[]
  activeKey: string | null
  onClose:   () => void
}

export default function PhotoLightbox({ keys, activeKey, onClose }: PhotoLightboxProps) {
  const initialIndex = activeKey ? Math.max(0, keys.indexOf(activeKey)) : -1
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    setIndex(activeKey ? Math.max(0, keys.indexOf(activeKey)) : -1)
  }, [activeKey, keys])

  useEffect(() => {
    if (index < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(keys.length - 1, i + 1))
      if (e.key === 'ArrowLeft')  setIndex((i) => Math.max(0, i - 1))
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [index, keys.length, onClose])

  if (index < 0 || !activeKey) return null
  const key = keys[index]
  if (!key) return null
  const url = resolvePhotoUrl(key)
  if (!url) return null

  const hasPrev = index > 0
  const hasNext = index < keys.length - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm tabular-nums">{index + 1} / {keys.length}</span>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-surface/10 hover:text-white"
            aria-label="Open original"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-surface/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className="relative flex h-full w-full items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={url}
          alt="Shared photo (full size)"
          width={1600}
          height={1200}
          className="max-h-[88vh] w-auto max-w-full select-none object-contain"
          unoptimized
          priority
        />
      </div>

      {hasPrev ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.max(0, i - 1)) }}
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-surface/10 text-white backdrop-blur transition-colors hover:bg-surface/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      {hasNext ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.min(keys.length - 1, i + 1)) }}
          aria-label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-surface/10 text-white backdrop-blur transition-colors hover:bg-surface/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}
    </div>
  )
}
