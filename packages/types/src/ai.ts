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
