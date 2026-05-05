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
