'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_DURATION_SEC = 120

interface VoiceRecorderProps {
  matchId:   string
  onSent:    (key: string, durationSec: number) => void
  disabled?: boolean
}

/**
 * Hold-and-record voice notes. Tap mic to start, tap stop to send, or X to
 * cancel. Records WebM/Opus by default; falls back gracefully on unsupported
 * browsers. Shows a live MM:SS timer + animated waveform bars.
 */
export default function VoiceRecorder({ matchId, onSent, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)
  const startedAtRef = useRef<number>(0)

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setSeconds(0)
  }

  useEffect(() => () => cleanup(), [])

  async function start() {
    if (disabled || uploading) return
    setError(null)
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const cancelled = cancelledRef.current
        const blob = new Blob(chunksRef.current, { type: mime })
        cleanup()
        setRecording(false)
        if (cancelled || blob.size === 0) return
        await upload(blob, mime, Math.min(MAX_DURATION_SEC, elapsedSec))
      }

      startedAtRef.current = Date.now()
      rec.start()
      setRecording(true)
      tickRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
        setSeconds(elapsed)
        if (elapsed >= MAX_DURATION_SEC) stop()
      }, 250)
    } catch {
      setError('Microphone access denied')
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  function cancel() {
    cancelledRef.current = true
    stop()
  }

  async function upload(blob: Blob, mime: string, duration: number) {
    setUploading(true)
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
      const ext = mime.includes('webm') ? 'webm' : 'audio'
      const res = await fetch(
        `${apiUrl}/api/v1/chat/conversations/${matchId}/voice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fileName: `voice-${Date.now()}.${ext}`,
            mimeType: mime,
            duration,
          }),
        },
      )
      const json = (await res.json()) as {
        success: boolean
        data: { uploadUrl: string; key: string }
      }
      if (!json.success) { setError('Upload failed'); return }
      await fetch(json.data.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': mime },
      })
      onSent(json.data.key, duration)
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (recording) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return (
      <div className="flex flex-1 items-center gap-2 rounded-2xl bg-destructive/10 border border-destructive/30 px-3 py-2">
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel recording"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="flex h-2 items-end gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="block w-1 animate-pulse rounded-full bg-destructive"
              style={{
                height: `${4 + ((seconds + i) % 4) * 3}px`,
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </span>
        <span className="flex-1 text-xs font-mono text-destructive">
          Recording · {mm}:{ss}
        </span>
        <button
          type="button"
          onClick={stop}
          aria-label="Stop and send"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-white hover:bg-destructive/90"
        >
          <Square className="h-3.5 w-3.5 fill-white" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={start}
        disabled={disabled || uploading}
        aria-label={uploading ? 'Sending voice note…' : 'Record voice note'}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-surface text-muted-foreground transition-colors',
          uploading ? 'opacity-50' : 'hover:border-gold hover:text-primary',
        )}
      >
        <Mic className="h-5 w-5" />
      </button>
      {error ? (
        <p
          role="alert"
          className="absolute -top-7 left-0 whitespace-nowrap text-[10px] text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
