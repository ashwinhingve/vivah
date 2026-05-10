/**
 * faqService.ts — HTTP client for the Python FAQ (Function Attendance Quotient) service.
 *
 * In mock mode (USE_MOCK_SERVICES=true) returns deterministic stub predictions
 * keyed on rsvp_response so tests pass without a live ai-service.
 *
 * In live mode, POSTs each item individually to /ai/faq/predict with an 8s timeout.
 * Promise.all is safe for typical wedding invite sizes (<500 guests).
 */

import { env } from '../lib/env.js';
import type { FaqFeatureRow } from './faqFeatures.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FaqDirection = 'attend' | 'skip' | 'uncertain';

export interface FaqPrediction {
  guestId:              string;
  ceremonyId:           string;
  predictedProbability: number;
  confidenceBand:       'high' | 'medium' | 'low';
  direction:            FaqDirection;
  rsvpResponse:         string;
}

interface AiServiceFaqResponse {
  predicted_probability: number;
  confidence_band:       'high' | 'medium' | 'low';
  direction:             FaqDirection;
}

// ── Error helper ──────────────────────────────────────────────────────────────

interface AppError extends Error {
  code:   string;
  status: number;
}

function makeAppError(code: string, message: string, status: number): AppError {
  const e = new Error(message) as AppError;
  e.code   = code;
  e.status = status;
  return e;
}

// ── Mock stub ─────────────────────────────────────────────────────────────────

/**
 * Deterministic stub prediction — no real ai-service call.
 * Used when USE_MOCK_SERVICES=true (dev / CI / tests).
 *
 *   yes     → 0.92, high
 *   no      → 0.04, high
 *   maybe   → 0.55, medium
 *   pending → 0.40, medium
 */
function stubPrediction(item: FaqFeatureRow): FaqPrediction {
  const rsvp = item.input.rsvp_response;

  let predictedProbability: number;
  let confidenceBand: 'high' | 'medium' | 'low';
  let direction: FaqDirection;

  switch (rsvp) {
    case 'yes':
      predictedProbability = 0.92;
      confidenceBand       = 'high';
      direction            = 'attend';
      break;
    case 'no':
      predictedProbability = 0.04;
      confidenceBand       = 'high';
      direction            = 'skip';
      break;
    case 'maybe':
      predictedProbability = 0.55;
      confidenceBand       = 'medium';
      direction            = 'uncertain';
      break;
    case 'pending':
    default:
      predictedProbability = 0.40;
      confidenceBand       = 'low';
      direction            = 'uncertain';
      break;
  }

  return {
    guestId:              item.guestId,
    ceremonyId:           item.ceremonyId,
    predictedProbability,
    confidenceBand,
    direction,
    rsvpResponse:         rsvp,
  };
}

// ── Live prediction ───────────────────────────────────────────────────────────

async function predictOne(item: FaqFeatureRow): Promise<FaqPrediction> {
  const response = await fetch(`${env.AI_SERVICE_URL}/ai/faq/predict`, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify({
      guest_id:    item.guestId,
      ceremony_id: item.ceremonyId,
      features:    item.input,
    }),
    // 8s — model inference is fast (<200ms), safety margin for network
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw makeAppError(
      'AI_SERVICE_UNAVAILABLE',
      `FAQ predict returned HTTP ${response.status}`,
      503,
    );
  }

  const data = (await response.json()) as AiServiceFaqResponse;

  return {
    guestId:              item.guestId,
    ceremonyId:           item.ceremonyId,
    predictedProbability: data.predicted_probability,
    confidenceBand:       data.confidence_band,
    direction:            data.direction,
    rsvpResponse:         item.input.rsvp_response,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Predict attendance probability for a batch of guest feature rows.
 *
 * - Mock mode: deterministic stubs, no network calls.
 * - Live mode: parallel fetch to ai-service /ai/faq/predict (Promise.all).
 *
 * @throws AppError('AI_SERVICE_UNAVAILABLE', ..., 503) on any network/non-2xx failure.
 */
export async function predictBatch(items: FaqFeatureRow[]): Promise<FaqPrediction[]> {
  if (env.USE_MOCK_SERVICES) {
    return items.map(stubPrediction);
  }

  return Promise.all(items.map(predictOne));
}
