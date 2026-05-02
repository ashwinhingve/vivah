import Image from 'next/image'
import { Link2 } from 'lucide-react'
import type { LinkPreview } from '@smartshaadi/types'
import { cn } from '@/lib/utils'

interface LinkPreviewCardProps {
  preview:   LinkPreview
  isSentByMe: boolean
}

/**
 * Compact OG preview rendered inside (or below) a TEXT bubble. Click opens the
 * source URL in a new tab.
 */
export default function LinkPreviewCard({ preview, isSentByMe }: LinkPreviewCardProps) {
  let host = ''
  try { host = new URL(preview.url).host.replace(/^www\./, '') } catch { /* noop */ }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-1 block max-w-[280px] overflow-hidden rounded-xl border transition-colors',
        isSentByMe
          ? 'border-white/30 bg-white/10 hover:bg-white/15'
          : 'border-gold/20 bg-surface-muted hover:bg-surface',
      )}
    >
      {preview.image ? (
        <div className="relative aspect-[1.91/1] w-full bg-black/5">
          <Image
            src={preview.image}
            alt=""
            fill
            sizes="280px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : null}
      <div className="px-3 py-2">
        <p className={cn(
          'flex items-center gap-1 text-[10px] uppercase tracking-wide',
          isSentByMe ? 'text-white/70' : 'text-muted-foreground',
        )}>
          <Link2 className="h-3 w-3" />
          {host || 'link'}
        </p>
        {preview.title ? (
          <p className={cn(
            'mt-0.5 text-sm font-semibold leading-snug line-clamp-2',
            isSentByMe ? 'text-white' : 'text-foreground',
          )}>
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p className={cn(
            'mt-0.5 text-xs leading-snug line-clamp-2',
            isSentByMe ? 'text-white/80' : 'text-muted-foreground',
          )}>
            {preview.description}
          </p>
        ) : null}
      </div>
    </a>
  )
}
