import type { CompatibilityScore } from '@smartshaadi/types';

/**
 * Format a compatibility score (0-100) as a percentage with one decimal.
 */
export function formatCompatibilityScore(score: number): string {
  return Math.round(score * 10) / 10 + '%';
}

/**
 * Map a compatibility tier to a theme-palette key. Returning a semantic key
 * (rather than a fixed hex) keeps the tier badge correct in both light and dark
 * themes — the caller resolves it against the active palette, e.g.
 * `colors[getTierColor(tier)]`.
 */
export type TierColorKey = 'success' | 'gold' | 'warning' | 'destructive';

export function getTierColor(
  tier: 'excellent' | 'good' | 'average' | 'low',
): TierColorKey {
  switch (tier) {
    case 'excellent':
      return 'success';
    case 'good':
      return 'gold';
    case 'average':
      return 'warning';
    case 'low':
      return 'destructive';
  }
}

/**
 * Format a score component (partial score out of max).
 */
export function formatScoreComponent(
  score: number,
  max: number,
): string {
  const percent = Math.round((score / max) * 100);
  return `${score}/${max} (${percent}%)`;
}

/**
 * Get a tier label for display.
 */
export function getTierLabel(tier: 'excellent' | 'good' | 'average' | 'low'): string {
  switch (tier) {
    case 'excellent':
      return 'Excellent Match';
    case 'good':
      return 'Good Match';
    case 'average':
      return 'Average Match';
    case 'low':
      return 'Low Compatibility';
  }
}

/**
 * Render breakdown summary as human-readable text.
 */
export function describeCompatibilityBreakdown(score: CompatibilityScore): string {
  const parts: string[] = [];

  if (score.breakdown.demographicAlignment) {
    parts.push(
      `Demographic: ${formatScoreComponent(score.breakdown.demographicAlignment.score, score.breakdown.demographicAlignment.max)}`,
    );
  }
  if (score.breakdown.lifestyleCompatibility) {
    parts.push(
      `Lifestyle: ${formatScoreComponent(score.breakdown.lifestyleCompatibility.score, score.breakdown.lifestyleCompatibility.max)}`,
    );
  }
  if (score.breakdown.preferenceOverlap) {
    parts.push(
      `Preferences: ${formatScoreComponent(score.breakdown.preferenceOverlap.score, score.breakdown.preferenceOverlap.max)}`,
    );
  }

  return parts.join(' • ');
}
