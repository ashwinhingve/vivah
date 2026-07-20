'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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

function badgeStyles(label: EmotionalScore['label']): string {
  if (label === 'WARM') return 'bg-teal/15 text-teal border-teal/30'
  if (label === 'COOLING') return 'bg-primary/15 text-primary border-primary/30'
  return 'bg-gold/15 text-gold-muted border-gold/40'
}

function trendArrow(trend: EmotionalScore['trend']): string | null {
  if (trend === 'improving') return '↑'
  if (trend === 'declining') return '↓'
  return null
}

export default function EmotionalScoreBadge({ matchId }: EmotionalScoreBadgeProps) {
  const t = useTranslations('emotionalScore')
  const [score, setScore] = useState<EmotionalScore | null>(null)
  const [loading, setLoading] = useState(true)

  const sentimentLabel = (v: number): string => {
    if (v > 70) return t('sentiment.warm')
    if (v >= 40) return t('sentiment.neutral')
    return t('sentiment.cool')
  }

  const enthusiasmLabel = (v: number): string => {
    if (v > 70) return t('enthusiasm.fast')
    if (v >= 40) return t('enthusiasm.moderate')
    return t('enthusiasm.slow')
  }

  const engagementLabel = (v: number): string => {
    if (v > 70) return t('engagement.deepening')
    if (v >= 40) return t('engagement.consistent')
    return t('engagement.thinning')
  }

  const curiosityLabel = (v: number): string => {
    if (v > 70) return t('curiosity.lots')
    if (v >= 40) return t('curiosity.some')
    return t('curiosity.few')
  }

  const tooltipLines = (b: EmotionalBreakdown): string[] => {
    return [
      `${t('tooltipLabels.conversationTone')}: ${sentimentLabel(b.sentiment)}`,
      `${t('tooltipLabels.replyPace')}: ${enthusiasmLabel(b.enthusiasm)}`,
      `${t('tooltipLabels.messageDepth')}: ${engagementLabel(b.engagement)}`,
      `${t('tooltipLabels.questionsAsked')}: ${curiosityLabel(b.curiosity)}`,
    ]
  }

  const labelText = (label: EmotionalScore['label']): string => {
    if (label === 'WARM') return t('labels.warm')
    if (label === 'COOLING') return t('labels.cooling')
    return t('labels.steady')
  }

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
            aria-label={`${t('tooltipLabels.conversationTone')} ${labelText(score.label)}`}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border font-medium',
              'h-6 px-2 text-2xs sm:h-7 sm:px-3 sm:text-xs',
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
