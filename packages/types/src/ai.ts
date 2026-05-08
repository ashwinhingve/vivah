export interface CoachSuggestion {
  text: string;
  reason: string;
  tone: 'warm' | 'curious' | 'light';
}

export interface CoachResponse {
  suggestions: CoachSuggestion[];
  state: 'STARTING' | 'ACTIVE' | 'COOLING';
  cached: boolean;
  fallback?: boolean;
}

export interface EmotionalBreakdown {
  sentiment: number;
  enthusiasm: number;
  engagement: number;
  curiosity: number;
}

export interface EmotionalScore {
  score: number;
  label: 'WARM' | 'STEADY' | 'COOLING';
  trend: 'improving' | 'stable' | 'declining';
  breakdown: EmotionalBreakdown;
  last_updated: string;
  fallback?: boolean;
}

export interface DpiFactorContribution {
  factor: string;
  contribution: number;
  direction: 'protective' | 'concern' | 'neutral';
}

export interface DpiResponse {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  label: string;
  narrative: string;
  suggestion: string;
  top_factors: DpiFactorContribution[];
  disclaimer: string;
  fallback?: boolean;
}

export interface FiiBreakdown {
  family_type_preference: number;
  family_values_orientation: number;
  parents_living_intent: number;
  family_decisions: number;
  cultural_events: number;
  siblings_engagement: number;
  religious_practice: number;
}

export type FiiLabel =
  | 'Independent'
  | 'Independent-Leaning'
  | 'Balanced'
  | 'Family-Oriented'
  | 'Family-First';

export type FiiCompatibilityLabel =
  | 'Highly Aligned'
  | 'Mostly Aligned'
  | 'Worth Discussing'
  | 'Different Outlooks';

export interface FiiProfileScore {
  score: number;
  label: FiiLabel;
  breakdown: FiiBreakdown;
}

export interface FiiCompatibility {
  profile_a_score: FiiProfileScore;
  profile_b_score: FiiProfileScore;
  delta: number;
  compatibility: FiiCompatibilityLabel;
  compatibility_color: string;
  narrative: string;
  discussion_starter: string;
  narrative_source: 'template' | 'sonnet';
}
