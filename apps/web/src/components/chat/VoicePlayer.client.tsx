'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolvePhotoUrl } from '@/lib/photo'

interface VoicePlayerProps {
  voiceKey:      string
  durationSec:   number
  isSentByMe:    boolean
}

const BARS = 28

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(Math.floor(s % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

function pseudoBars(seed: string): number[] {
  const out: number[] = []
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  for (let i = 0; i < BARS; i++) {
    h = (h * 1103515245 + 12345) | 0
    out.push(0.35 + ((Math.abs(h) % 100) / 100) * 0.65)
  }
  return out
}

export default function VoicePlayer({ voiceKey, durationSec, isSentByMe }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [position, setPosition] = useState(0)
  const url = resolvePhotoUrl(voiceKey)
  const bars = pseudoBars(voiceKey)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      const dur = a.duration && Number.isFinite(a.duration) ? a.duration : durationSec
      setPosition(a.currentTime)
      setProgress(dur > 0 ? a.currentTime / dur : 0)
    }
    const onEnd = () => { setPlaying(false); setProgress(0); setPosition(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [durationSec])

  function toggle() {
    const a = audioRef.current
    if (!a || !url) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    if (!a) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const dur = a.duration && Number.isFinite(a.duration) ? a.duration : durationSec
    a.currentTime = ratio * dur
    setProgress(ratio)
  }

  if (!url) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-2xl px-3 py-2 shadow-sm min-w-[200px]',
        isSentByMe
          ? 'rounded-br-md bg-teal text-white'
          : 'rounded-bl-md border border-gold/20 bg-surface text-foreground',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
          isSentByMe
            ? 'bg-surface/20 hover:bg-surface/30 text-white'
            : 'bg-teal text-white hover:bg-teal-hover',
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>
      <div
        role="slider"
        aria-label="Voice note progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onClick={seekTo}
        className="flex flex-1 items-end gap-[2px] cursor-pointer h-7"
      >
        {bars.map((h, i) => {
          const filled = i / BARS <= progress
          return (
            <span
              key={i}
              className={cn(
                'block w-[3px] rounded-full transition-colors',
                filled
                  ? isSentByMe ? 'bg-surface' : 'bg-teal'
                  : isSentByMe ? 'bg-surface/40' : 'bg-muted-foreground/40',
              )}
              style={{ height: `${Math.round(h * 22) + 4}px` }}
            />
          )
        })}
      </div>
      <span
        className={cn(
          'text-[11px] font-mono tabular-nums shrink-0',
          isSentByMe ? 'text-white/85' : 'text-muted-foreground',
        )}
      >
        {formatTime(playing || position > 0 ? position : durationSec)}
      </span>
      <audio ref={audioRef} src={url} preload="none" className="hidden" />
    </div>
  )
}
