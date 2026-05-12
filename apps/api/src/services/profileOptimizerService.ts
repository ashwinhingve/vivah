/**
 * profileOptimizerService.ts — Node.js client for the Python AI service
 * Profile Optimizer endpoint.
 *
 * Mirrors the reputationService.ts pattern (X-Internal-Key header, 8s timeout,
 * AppError on non-2xx). Returns structured optimizer response.
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

export interface ProfileOptimizerPayload {
  user_id: string;
  photo_count: number;
  has_primary_photo: boolean;
  bio_text: string;
  profile_completeness: number;
}

export interface FieldSuggestion {
  field: string;
  score: number;
  priority: number;
  suggestion: string;
}

export interface DimensionScores {
  photo_score: number;
  bio_score: number;
  completeness_score: number;
}

export type ProfileOptimizerTier = 'excellent' | 'good' | 'needs_work' | 'incomplete';

export interface ProfileOptimizerResponse {
  user_id: string;
  overall_score: number;
  tier: ProfileOptimizerTier;
  dimensions: DimensionScores;
  field_suggestions: FieldSuggestion[];
  version: string;
}

export async function getProfileOptimizerScore(
  payload: ProfileOptimizerPayload,
): Promise<ProfileOptimizerResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/profile-optimizer/score`, {
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
      'Profile optimizer service unavailable',
      503,
    );
  }

  return response.json() as Promise<ProfileOptimizerResponse>;
}
