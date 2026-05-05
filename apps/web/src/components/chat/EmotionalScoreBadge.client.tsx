'use client'

import { useEffect, useState } from 'react'
import type { EmotionalBreakdown, EmotionalScore } from '@smartshaadi/types'
import { fetchEmotionalScore } from '@/app/actions/ai'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface EmotionalScoreBadgeProps {
  matchId: string
}

function sentimentLabel(v: number): string {
  if (v > 70) return 'warm tone'
  if (v >= 40) return 'neutral tone'
  return 'cool tone'
}
function enthusiasmLabel(v: number): string {
  if (v > 70) return 'fast replies'
  if (v >= 40) return 'moderate replies'
  return 'slow replies'
}
function engagementLabel(v: number): string {
  if (v > 70) return 'messages deepening'
  if (v >= 40) return 'consistent'
  return 'messages thinning'
}
function curiosityLabel(v: number): string {
  if (v > 70) return 'lots of questions'
  if (v >= 40) return 'some questions'
  return 'few questions'
}

function tooltipLines(b: EmotionalBreakdown): string[] {
  return [
    `Conversation tone: ${sentimentLabel(b.sentiment)}`,
    `Reply pace: ${enthusiasmLabel(b.enthusiasm)}`,
    `Message depth: ${engagementLabel(b.engagement)}`,
    `Questions asked: ${curiosityLabel(b.curiosity)}`,
  ]
}

function badgeStyles(label: EmotionalScore['label']): string {
  if (label === 'WARM') return 'bg-teal/15 text-teal border-teal/30'
  if (label === 'COOLING') return 'bg-primary/15 text-primary border-primary/30'
  return 'bg-gold/15 text-gold-muted border-gold/40'
}

function labelText(label: EmotionalScore['label']): string {
  if (label === 'WARM') return 'Warm'
  if (label === 'COOLING') return 'Cooling'
  return 'Steady'
}

function trendArrow(trend: EmotionalScore['trend']): string | null {
  if (trend === 'improving') return '↑'
  if (trend === 'declining') return '↓'
  return null
}

export default function EmotionalScoreBadge({ matchId }: EmotionalScoreBadgeProps) {
  const [score, setScore] = useState<EmotionalScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchEmotionalScore(matchId)
      .then((res) => {
        if (!cancelled) setScore(res)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [matchId])

  if (loading || !score) return null
  const isDefaultNeutral =
    score.score === 50 && score.label === 'STEADY' && score.trend === 'stable'
  if (isDefaultNeutral) return null

  const arrow = trendArrow(score.trend)
  const lines = tooltipLines(score.breakdown)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={`Conversation tone ${labelText(score.label)}`}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border font-medium',
              'h-6 px-2 text-[10px] sm:h-7 sm:px-3 sm:text-xs',
              badgeStyles(score.label),
            )}
          >
            <span>{labelText(score.label)}</span>
            {arrow ? <span aria-hidden="true">{arrow}</span> : null}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-[220px]">
          <div className="flex flex-col gap-0.5 text-left">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
