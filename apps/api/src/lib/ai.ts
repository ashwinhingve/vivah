import { env } from './env.js';

interface AiServiceError extends Error {
  code:   string;
  status: number;
}

/**
 * Internal HTTP client for the Python AI service.
 * All calls are fire-and-forget safe — callers handle their own errors.
 *
 * ON FAILURE this throws an error TAGGED with `code: 'AI_SERVICE_UNAVAILABLE'`.
 * That tag is load-bearing. Every caller of this function guards with
 * `if (err.code === 'AI_SERVICE_UNAVAILABLE') -> 503`, and until this function
 * started setting `code` those guards could never fire: a bare `new Error()`
 * has no `code`, so the check was always false and an AI-service outage
 * surfaced to users as an opaque 500 instead of "temporarily unavailable".
 * `services/aiService.ts` has always tagged its errors this way (makeAppError);
 * this client simply did not, so the two paths disagreed.
 *
 * The upstream status is preserved on `.status` and included in the message,
 * because the failures are not interchangeable in practice: 401 means the
 * X-Internal-Key does not match between the two services (a config problem,
 * and the local root .env drifting from apps/ai-service/.env has caused
 * exactly this), whereas ECONNREFUSED means the service is not running. Both
 * are "unavailable" to the user; they are very different to whoever is on call.
 */
export async function callAiService<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const fail = (message: string, status: number): AiServiceError => {
    const e = new Error(message) as AiServiceError;
    e.code   = 'AI_SERVICE_UNAVAILABLE';
    e.status = status;
    return e;
  };

  let res: Response;
  try {
    res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    // Network-level failure — service down, DNS, timeout.
    const reason = cause instanceof Error ? cause.message : 'unknown';
    throw fail(`AI service unreachable at ${path}: ${reason}`, 503);
  }

  if (!res.ok) {
    throw fail(`AI service error ${res.status} at ${path}: ${res.statusText}`, 503);
  }

  return res.json() as Promise<T>;
}
