import type { ApiResponse } from '@smartshaadi/types';
import { ApiRequestError, NetworkError } from './errors.js';

/**
 * Supplies the credential for each request.
 *
 * On React Native this returns the full Cookie header string produced by
 * `@better-auth/expo`'s `authClient.getCookie()` — e.g.
 * `better-auth.session_token=<value>` (or `__Secure-better-auth.session_token=…`
 * once the server sets Secure cookies in prod). We forward it verbatim as the
 * `Cookie` header rather than picking the token out of it: `authenticate` in
 * apps/api/src/auth/middleware.ts hands *all* request headers to Better Auth's
 * `getSession`, so the header the plugin already built is exactly what the
 * server wants, and forwarding it whole means the cookie NAME stays correct
 * across the dev/prod Secure-prefix difference instead of being hardcoded here.
 *
 * Returning null means "no session" — the request goes out unauthenticated and
 * will come back 401, which is the correct outcome rather than a thrown error.
 */
export type GetCookieHeader = () => string | null | Promise<string | null>;

export interface ApiClientConfig {
  baseUrl: string;
  getCookieHeader: GetCookieHeader;
  /** Per-request timeout. Mobile networks stall silently; never wait forever. */
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 20_000;

function buildUrl(
  baseUrl: string,
  path: string,
  query: RequestOptions['query'],
): string {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * The one place every mobile API call passes through.
 *
 * Responsibilities, deliberately kept to exactly these four:
 *   1. attach the session cookie
 *   2. unwrap the `{ success, data, error, meta }` envelope down to `data`
 *   3. turn every failure into `ApiRequestError` or `NetworkError`
 *   4. enforce a timeout
 *
 * It does NOT validate response bodies with Zod. The API is the contract and it
 * is typed in `@smartshaadi/types`; re-deriving those shapes here would create a
 * second source of truth that drifts silently the first time an endpoint adds a
 * field. Zod stays on the *request* side, via `@smartshaadi/schemas`.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getCookieHeader: GetCookieHeader;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getCookieHeader = config.getCookieHeader;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, path, options.query);
    const cookie = await this.getCookieHeader();

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    // Compose our timeout with any caller-supplied signal (React Query passes
    // one on unmount), so whichever fires first aborts the request.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onCallerAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', onCallerAbort);

    // Built conditionally rather than passing `body: undefined`: the repo runs
    // `exactOptionalPropertyTypes`, under which handing an explicit undefined to
    // an optional property is an error, not a no-op.
    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      throw new NetworkError(
        `Could not reach the server (${method} ${path}).`,
        cause,
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onCallerAbort);
    }

    // 204 and other empty bodies are legitimate successes for DELETEs.
    const text = await response.text();
    if (!text) {
      if (response.ok) return undefined as T;
      throw new ApiRequestError(
        'EMPTY_RESPONSE',
        `Request failed with status ${response.status}.`,
        response.status,
      );
    }

    let envelope: ApiResponse<T>;
    try {
      envelope = JSON.parse(text) as ApiResponse<T>;
    } catch {
      // Non-JSON body: a proxy/CDN error page, or an HTML 502. Surfacing the
      // status is more useful than surfacing a JSON parse error.
      throw new ApiRequestError(
        'MALFORMED_RESPONSE',
        `Server returned a non-JSON response (status ${response.status}).`,
        response.status,
      );
    }

    if (!response.ok || envelope.success === false) {
      const error = envelope.success === false ? envelope.error : undefined;
      const { code, message, ...details } = error ?? {};
      throw new ApiRequestError(
        code ?? 'UNKNOWN_ERROR',
        message ?? `Request failed with status ${response.status}.`,
        response.status,
        details,
      );
    }

    return envelope.data;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
