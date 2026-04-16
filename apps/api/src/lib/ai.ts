import { env } from './env.js';

/**
 * Internal HTTP client for the Python AI service.
 * All calls are fire-and-forget safe — callers handle their own errors.
 */
export async function callAiService<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`AI service error ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
