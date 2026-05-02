import type { MessageReaction } from '@smartshaadi/types'
import { cn } from '@/lib/utils'

interface ReactionStripProps {
  reactions:    MessageReaction[]
  currentProfileId: string | null
  isSentByMe:  boolean
  onToggle?:   (emoji: string) => void
}

/**
 * Displays grouped reactions (e.g. "❤️ 2  😂 1") under a message bubble.
 * The current user's own reaction is highlighted with a teal ring.
 */
export default function ReactionStrip({
  reactions,
  currentProfileId,
  isSentByMe,
  onToggle,
}: ReactionStripProps) {
  if (reactions.length === 0) return null

  const groups = new Map<string, { count: number; mine: boolean }>()
  for (const r of reactions) {
    const g = groups.get(r.emoji) ?? { count: 0, mine: false }
    g.count++
    if (r.profileId === currentProfileId) g.mine = true
    groups.set(r.emoji, g)
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 mt-1',
        isSentByMe ? 'justify-end' : 'justify-start',
      )}
    >
      {[...groups.entries()].map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle?.(emoji)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none border transition-colors',
            mine
              ? 'bg-teal/10 border-teal/40 text-teal'
              : 'bg-surface border-border text-muted-foreground hover:bg-surface-muted',
          )}
        >
          <span className="text-sm leading-none">{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
    </div>
  )
}
