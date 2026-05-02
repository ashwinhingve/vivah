import type { ReplySnapshot } from '@smartshaadi/types'
import { cn } from '@/lib/utils'

interface ReplyQuoteProps {
  reply:           ReplySnapshot
  currentProfileId: string
  variant:         'bubble' | 'composer'
  otherName?:      string | null
}

/**
 * Renders the small quoted-reply pill embedded inside a message bubble.
 * In `composer` variant it's used above the input as the active reply target.
 */
export default function ReplyQuote({ reply, currentProfileId, variant, otherName }: ReplyQuoteProps) {
  const fromMe = reply.senderId === currentProfileId
  const senderLabel = fromMe ? 'You' : (otherName ?? 'Reply')
  return (
    <div
      className={cn(
        'mb-1 border-l-2 pl-2 pr-3 py-1 rounded-md text-xs',
        variant === 'bubble'
          ? 'bg-black/[0.04] border-teal'
          : 'bg-surface-muted border-teal',
      )}
    >
      <p className={cn(
        'font-semibold mb-0.5',
        fromMe ? 'text-teal' : 'text-primary',
      )}>
        {senderLabel}
      </p>
      <p className="text-muted-foreground line-clamp-1 break-words">
        {reply.preview}
      </p>
    </div>
  )
}
