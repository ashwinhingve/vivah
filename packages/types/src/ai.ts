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
