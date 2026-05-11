/**
 * reputationService.ts — Node.js client for the Python AI service Reputation
 * Score endpoint.
 *
 * Mirrors the stayService.ts pattern (X-Internal-Key header, 8s timeout,
 * AppError on non-2xx). Admin-only endpoint — callers surface 503 instead of
 * a graceful fallback.
 */
import { env } from '../lib/env.js';

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

export interface ReputationFeaturesPayload {
  response_rate: number;
  message_response_rate: number;
  avg_response_time_hours_norm: number;
  ghost_count_norm: number;
  consistency_score: number;
}

export interface ReputationFactorContribution {
  factor: string;
  contribution: number;
  direction: 'protective' | 'concern' | 'neutral';
}

export type ReputationTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'flagged';

export interface ReputationResponse {
  user_id: string;
  reputation_score: number;
  tier: ReputationTier;
  ghost_count: number;
  primary_strength: string;
  primary_concern: string | null;
  feature_contributions: ReputationFactorContribution[];
  disclaimer: string;
}

export async function getReputation(
  userId: string,
  features: ReputationFeaturesPayload,
  ghostCountRaw: number,
): Promise<ReputationResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/reputation/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify({
      user_id: userId,
      features,
      ghost_count_raw: ghostCountRaw,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw makeAppError(
      'AI_SERVICE_UNAVAILABLE',
      'Reputation service unavailable',
      503,
    );
  }

  return response.json() as Promise<ReputationResponse>;
}
