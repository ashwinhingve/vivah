/**
 * marriageReadinessService.ts — Node.js client for the Python AI service
 * Marriage Readiness Score endpoint.
 *
 * Mirrors the reputationService.ts pattern (X-Internal-Key header, 8s timeout,
 * AppError on non-2xx).
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

export interface MarriageReadinessPayload {
  user_id: string;
  avg_msg_count_per_conv: number;
  avg_msg_length: number;
  profile_completeness: number;
  age_pref_set: boolean;
  religion_pref_set: boolean;
  distance_pref_set: boolean;
  education_pref_set: boolean;
  lifestyle_pref_set: boolean;
}

export interface ReadinessDimensions {
  communication_depth: number;
  completeness: number;
  goal_clarity: number;
}

export interface MarriageReadinessResponse {
  user_id: string;
  readiness_score: number;
  dimensions: ReadinessDimensions;
  next_actions: string[];
  version: string;
}

export async function getMarriageReadinessScore(
  payload: MarriageReadinessPayload,
): Promise<MarriageReadinessResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/marriage-readiness/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw makeAppError(
      'AI_SERVICE_UNAVAILABLE',
      'Marriage readiness service unavailable',
      503,
    );
  }

  return response.json() as Promise<MarriageReadinessResponse>;
}
