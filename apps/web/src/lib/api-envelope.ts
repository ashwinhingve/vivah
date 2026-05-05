/**
 * Standard Smart Shaadi API envelope: { success, data, error, meta }.
 * `error` is `{ code, message }` (see apps/api/src/lib/response.ts), not a string.
 * Some legacy clients still type it as `string`. Use this helper everywhere we
 * read an error off an envelope so a future shape change has one place to touch.
 */

export type ApiError = { code: string; message: string };

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError | string;
  meta?: Record<string, unknown>;
}

export function extractErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const e = (json as { error?: unknown }).error;
  if (typeof e === 'string' && e.length > 0) return e;
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return fallback;
}
