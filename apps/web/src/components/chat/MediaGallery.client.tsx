'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, Image as ImageIcon, Mic } from 'lucide-react'
import { resolvePhotoUrl } from '@/lib/photo'
import VoicePlayer from './VoicePlayer.client'
import { cn } from '@/lib/utils'

interface MediaGalleryProps {
  open:        boolean
  matchId:     string
  onClose:     () => void
  onPhotoTap?: (photoKey: string) => void
}

interface PhotoItem { messageId: string; photoKey: string; sentAt: string; senderId: string }
interface VoiceItem { messageId: string; voiceKey: string; voiceDuration: number | null; sentAt: string; senderId: string }

type Tab = 'photos' | 'voices'

export default function MediaGallery({ open, matchId, onClose, onPhotoTap }: MediaGalleryProps) {
  const [tab, setTab] = useState<Tab>('photos')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [voices, setVoices] = useState<VoiceItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    let cancelled = false
    setLoading(true)
    fetch(`${apiUrl}/api/v1/chat/conversations/${matchId}/media`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { success: boolean; data: { photos: PhotoItem[]; voices: VoiceItem[] } }) => {
        if (cancelled || !j.success) return
        setPhotos(j.data.photos ?? [])
        setVoices(j.data.voices ?? [])
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchId, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-auto flex h-[88vh] flex-col rounded-t-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-4 py-3">
          <h2 className="font-heading text-base font-semibold text-[#0F172A]">Media & files</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Media tabs" className="flex gap-1 border-b border-border px-4 py-2">
          <TabBtn label="Photos" icon={<ImageIcon className="h-4 w-4" />} active={tab === 'photos'} onClick={() => setTab('photos')} count={photos.length} />
          <TabBtn label="Voices" icon={<Mic className="h-4 w-4" />} active={tab === 'voices'} onClick={() => setTab('voices')} count={voices.length} />
        </nav>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          ) : tab === 'photos' ? (
            photos.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No photos shared yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((p) => {
                  const url = resolvePhotoUrl(p.photoKey)
                  if (!url) return null
                  return onPhotoTap ? (
                    <button
                      key={p.messageId}
                      type="button"
                      onClick={() => { onClose(); onPhotoTap(p.photoKey) }}
                      className="relative block aspect-square overflow-hidden rounded-md bg-surface-muted transition-transform active:scale-95"
                      aria-label="Open photo"
                    >
                      <Image src={url} alt="" aria-hidden="true" fill sizes="33vw" className="object-cover" />
                    </button>
                  ) : (
                    <a
                      key={p.messageId}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-square overflow-hidden rounded-md bg-surface-muted"
                      aria-label="Open shared photo in new tab"
                    >
                      <Image src={url} alt="" aria-hidden="true" fill sizes="33vw" className="object-cover" />
                    </a>
                  )
                })}
              </div>
            )
          ) : (
            voices.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No voice notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {voices.map((v) => (
                  <li key={v.messageId} className="rounded-xl border border-gold/20 p-2">
                    <p className="px-1 pb-1 text-[11px] text-muted-foreground">
                      {new Date(v.sentAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <VoicePlayer voiceKey={v.voiceKey} durationSec={v.voiceDuration ?? 0} isSentByMe={false} />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({
  label, icon, active, onClick, count,
}: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-teal text-white' : 'text-muted-foreground hover:bg-surface-muted',
      )}
    >
      {icon}
      {label}
      <span className={cn('text-[10px]', active ? 'text-white/80' : 'text-muted-foreground/70')}>
        ({count})
      </span>
    </button>
  )
}
