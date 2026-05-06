/**
 * aiService.ts — Node.js client for the Python AI service (FastAPI).
 *
 * All calls are authenticated via the shared X-Internal-Key header.
 * Callers must handle AppError('AI_SERVICE_UNAVAILABLE') and fall back
 * gracefully — never surface a 500 to end users when this service is down.
 */
import { env } from '../lib/env.js';

// ── Error type ────────────────────────────────────────────────────────────────

interface AppError extends Error {
  code: string;
  status: number;
}

function makeAppError(code: string, message: string, status: number): AppError {
  const e = new Error(message) as AppError;
  e.code = code;
  e.status = status;
  return e;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileSnapshot {
  profile_id: string;
  interests: string[];
  hobbies: string[];
  bio: string;
  occupation: string;
  city: string;
}

export interface CoachSuggestion {
  text: string;
  reason: string;
  tone: 'warm' | 'curious' | 'light';
}

export interface CoachResponse {
  suggestions: CoachSuggestion[];
  state: 'STARTING' | 'ACTIVE' | 'COOLING';
  cached: boolean;
}

export type ConversationMessage = {
  sender: 'A' | 'B';
  text: string;
  timestamp: string;
};

// ── Emotional Score ───────────────────────────────────────────────────────────

export interface EmotionalBreakdown {
  sentiment:   number;
  enthusiasm:  number;
  engagement:  number;
  curiosity:   number;
}

export interface EmotionalScoreResponse {
  score:        number;
  label:        'WARM' | 'STEADY' | 'COOLING';
  trend:        'improving' | 'stable' | 'declining';
  breakdown:    EmotionalBreakdown;
  last_updated: string;
}

/**
 * Call the ai-service /ai/emotional/score endpoint.
 * Throws AppError('AI_SERVICE_UNAVAILABLE') on non-2xx or timeout.
 * Callers must catch and return the STEADY/stable fallback.
 */
export async function getEmotionalScore(
  matchId: string,
  messages: ConversationMessage[],
  historicalAvg: number | null = null,
): Promise<EmotionalScoreResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/emotional/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify({
      match_id:       matchId,
      messages,
      historical_avg: historicalAvg,
    }),
    // 8s — model inference is fast (<100ms), safety margin for network
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw makeAppError('AI_SERVICE_UNAVAILABLE', 'Emotional score temporarily unavailable', 503);
  }

  return response.json() as Promise<EmotionalScoreResponse>;
}

// ── Conversation Coach ────────────────────────────────────────────────────────

/**
 * Call the AI service's Conversation Coach endpoint to get message suggestions.
 *
 * Throws AppError('AI_SERVICE_UNAVAILABLE', ..., 503) on non-2xx or timeout.
 * Callers should catch and return a graceful fallback instead of re-throwing.
 */
export async function getConversationSuggestions(
  profileA: ProfileSnapshot,
  profileB: ProfileSnapshot,
  conversationHistory: ConversationMessage[],
  matchId: string,
): Promise<CoachResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/coach/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify({
      profile_a: profileA,
      profile_b: profileB,
      conversation_history: conversationHistory,
      match_id: matchId,
    }),
    // 12s timeout — Claude Sonnet p99 latency + safety margin
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw makeAppError(
      'AI_SERVICE_UNAVAILABLE',
      'Conversation suggestions temporarily unavailable',
      503,
    );
  }

  return response.json() as Promise<CoachResponse>;
}

// ── Divorce Probability Indicator (DPI) ───────────────────────────────────────

export interface DpiFeaturePayload {
  age_gap_years: number;
  education_gap: number;
  income_disparity_pct: number;
  family_values_alignment: number;
  lifestyle_compatibility: number;
  communication_score: number;
  guna_milan_score: number;
  geographic_distance_km: number;
  religion_caste_match: number;
  preference_match_pct: number;
}

export interface DpiTopFactor {
  factor: string;
  weight: number;
  direction: string;
}

export interface DpiResponse {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  label: string;
  narrative: string;
  suggestion: string;
  top_factors: DpiTopFactor[];
  shared_strengths: string[];
  disclaimer: string;
  computed_at: string;
  fallback?: boolean;
}

/**
 * Call the ai-service /ai/dpi/compute endpoint.
 * Uses a 15s timeout — Opus 4.7 narrative generation is ~3-5s slower than Sonnet.
 * Throws AppError('AI_SERVICE_UNAVAILABLE') on non-2xx or timeout.
 * Callers must catch and return a graceful fallback instead of re-throwing.
 */
export async function getDivorceProbability(
  requestingUserId: string,
  matchId: string,
  features: DpiFeaturePayload,
  profileSummaries: { a: string; b: string },
  sharedStrengths: string[],
): Promise<DpiResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/dpi/compute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify({
      requesting_user_id: requestingUserId,
      match_id: matchId,
      features,
      profile_summaries: profileSummaries,
      shared_strengths: sharedStrengths,
    }),
    // 15s timeout — Opus 4.7 narrative is ~3-5s; safety margin for network
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw makeAppError('AI_SERVICE_UNAVAILABLE', 'Divorce indicator temporarily unavailable', 503);
  }

  return response.json() as Promise<DpiResponse>;
}
