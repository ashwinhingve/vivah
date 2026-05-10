/**
 * stayService.ts — Node.js client for the Python AI service Stay Quotient
 * (churn risk) endpoint.
 *
 * Mirrors the aiService.ts patterns (X-Internal-Key header, 8s timeout,
 * AppError on non-2xx). Admin-only — no graceful fallback at the service
 * layer; callers should surface 503 to the admin UI/CLI.
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

export interface StayFeaturesPayload {
  user_id: string;
  days_since_last_login: number;
  messages_sent_last_7d: number;
  profile_views_received_7d: number;
  matches_accepted_total: number;
  profile_completeness: number;
  days_since_signup: number;
  has_active_match_request: boolean;
}

export interface StayFactorContribution {
  factor: string;
  contribution: number;
}

export type StayRiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface StayQuotientResponse {
  user_id: string;
  churn_probability: number;
  risk_band: StayRiskBand;
  primary_signal: string;
  recommended_action: string;
  feature_contributions: StayFactorContribution[];
  model_version: string;
}

export async function getStayQuotient(
  features: StayFeaturesPayload,
): Promise<StayQuotientResponse> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/stay/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify(features),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw makeAppError(
      'AI_SERVICE_UNAVAILABLE',
      'Stay Quotient service unavailable',
      503,
    );
  }

  return response.json() as Promise<StayQuotientResponse>;
}
