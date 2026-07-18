import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../client.js';
import { ApiRequestError, NetworkError } from '../errors.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successEnvelope<T>(data: T): unknown {
  return {
    success: true,
    data,
    error: null,
    meta: { timestamp: '2026-07-18T00:00:00.000Z' },
  };
}

function client(
  fetchImpl: typeof fetch,
  cookie: string | null = 'better-auth.session_token=tok123',
): ApiClient {
  return new ApiClient({
    baseUrl: 'https://api.example.test',
    getCookieHeader: () => cookie,
    fetchImpl,
  });
}

describe('ApiClient', () => {
  describe('envelope handling', () => {
    it('unwraps to `data`, not the whole envelope', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(successEnvelope({ id: 'p1', name: 'Asha' })),
      ) as unknown as typeof fetch;

      const result = await client(fetchImpl).get<{ id: string; name: string }>(
        '/api/v1/profiles/me',
      );

      // The whole point of the client: callers see `data`, never `success`/`meta`.
      expect(result).toEqual({ id: 'p1', name: 'Asha' });
      expect(result).not.toHaveProperty('success');
      expect(result).not.toHaveProperty('meta');
    });

    it('throws ApiRequestError carrying the API error code, not the HTTP status text', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(
          {
            success: false,
            data: null,
            error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' },
            meta: { timestamp: '2026-07-18T00:00:00.000Z' },
          },
          404,
        ),
      ) as unknown as typeof fetch;

      const error = await client(fetchImpl)
        .get('/api/v1/profiles/nope')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).code).toBe('PROFILE_NOT_FOUND');
      expect((error as ApiRequestError).httpStatus).toBe(404);
    });

    it('treats a 200 with success:false as a failure', async () => {
      // Guards the subtle case: some handlers return 200 with an error envelope.
      // Checking only `response.ok` would hand callers `undefined` as data.
      const fetchImpl = vi.fn(async () =>
        jsonResponse({
          success: false,
          data: null,
          error: { code: 'RATE_LIMITED', message: 'Slow down' },
          meta: { timestamp: '2026-07-18T00:00:00.000Z' },
        }),
      ) as unknown as typeof fetch;

      await expect(client(fetchImpl).get('/api/v1/matchmaking/feed')).rejects.toBeInstanceOf(
        ApiRequestError,
      );
    });

    it('surfaces the status when the body is not JSON', async () => {
      const fetchImpl = vi.fn(
        async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }),
      ) as unknown as typeof fetch;

      const error = await client(fetchImpl)
        .get('/api/v1/profiles/me')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).code).toBe('MALFORMED_RESPONSE');
      expect((error as ApiRequestError).httpStatus).toBe(502);
    });

    it('resolves an empty 204 body instead of failing to parse it', async () => {
      // Body must be `null`, not `''`: the Response constructor rejects ANY body
      // with a 204 ("Invalid response status code 204"). Passing '' throws
      // inside the mock itself, which the client then reports as a NetworkError
      // — the test fails while telling you nothing about the 204 path.
      const fetchImpl = vi.fn(
        async () => new Response(null, { status: 204 }),
      ) as unknown as typeof fetch;

      await expect(
        client(fetchImpl).delete('/api/v1/matchmaking/shortlists/p1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('authentication', () => {
    it('forwards the cookie header verbatim', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(successEnvelope({ ok: true })),
      ) as unknown as typeof fetch;

      await client(fetchImpl, '__Secure-better-auth.session_token=abc').get(
        '/api/v1/profiles/me',
      );

      const init = vi.mocked(fetchImpl).mock.calls[0]?.[1];
      const headers = init?.headers as Record<string, string>;
      // Verbatim matters: rebuilding the cookie name here would break the
      // dev (`better-auth.…`) vs prod (`__Secure-better-auth.…`) difference.
      expect(headers['Cookie']).toBe('__Secure-better-auth.session_token=abc');
    });

    it('omits the Cookie header entirely when there is no session', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(successEnvelope({ ok: true })),
      ) as unknown as typeof fetch;

      await client(fetchImpl, null).get('/api/v1/profiles/me');

      const init = vi.mocked(fetchImpl).mock.calls[0]?.[1];
      expect(init?.headers as Record<string, string>).not.toHaveProperty('Cookie');
    });
  });

  describe('request construction', () => {
    it('builds the URL with query params and drops undefined ones', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(successEnvelope({ items: [] })),
      ) as unknown as typeof fetch;

      await client(fetchImpl).get('/api/v1/matchmaking/feed', {
        query: { page: 2, limit: 20, refresh: undefined },
      });

      const url = vi.mocked(fetchImpl).mock.calls[0]?.[0];
      expect(url).toBe('https://api.example.test/api/v1/matchmaking/feed?page=2&limit=20');
    });

    it('serialises the body and sets Content-Type only when there is one', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(successEnvelope({ id: 'r1' })),
      ) as unknown as typeof fetch;

      await client(fetchImpl).post('/api/v1/matchmaking/requests', {
        toProfileId: 'p2',
      });

      const init = vi.mocked(fetchImpl).mock.calls[0]?.[1];
      expect(init?.body).toBe('{"toProfileId":"p2"}');
      expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
    });
  });

  describe('network failures', () => {
    it('wraps a transport failure as NetworkError, not ApiRequestError', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new TypeError('Network request failed');
      }) as unknown as typeof fetch;

      const error = await client(fetchImpl)
        .get('/api/v1/profiles/me')
        .catch((e: unknown) => e);

      // The distinction drives the UI: NetworkError → "retry",
      // ApiRequestError → "here is what was wrong with the request".
      expect(error).toBeInstanceOf(NetworkError);
      expect(error).not.toBeInstanceOf(ApiRequestError);
    });
  });
});
