import { createAuthClient } from 'better-auth/react';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { phoneNumberClient, twoFactorClient } from 'better-auth/client/plugins';
import { expoClient, getCookie } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './env';

/**
 * Key the expo plugin persists its cookie jar under. The plugin derives this as
 * `${storagePrefix}_cookie`, so it MUST stay in lockstep with the
 * `storagePrefix` passed to `expoClient()` below — they are two halves of one
 * constant and drifting them apart silently yields a permanently empty session.
 */
const STORAGE_PREFIX = 'smartshaadi';
const COOKIE_STORAGE_KEY = `${STORAGE_PREFIX}_cookie`;

/**
 * Key the bearer-token plugin (below) persists the raw session token under.
 * This token — NOT the cookie — is the credential for everything outside
 * better-auth: `@smartshaadi/api-client`, the Socket.io handshake, and the
 * boot-gate direct fetch. See ADR-002 (mobile uses the token path, not cookies)
 * and the `bearerTokenPlugin` doc below for why.
 */
const AUTH_TOKEN_STORAGE_KEY = `${STORAGE_PREFIX}_auth_token`;

// `@better-auth/expo` builds its expoClient plugin against a bundled copy of
// @better-fetch, whose `fetchPlugins`/headers types are structurally wider than
// the ones better-auth's `BetterAuthClientPlugin` expects. The values are
// runtime-compatible (same package, same version 1.6.2) — only the emitted
// declaration types diverge — so we assert the one plugin to the interface it
// satisfies. This is a scoped interop cast, NOT `any`: every other plugin in the
// array keeps full inference (phoneNumber methods + session user fields stay typed).
const expoAuthPlugin = expoClient({
  scheme: 'smartshaadi',
  storagePrefix: STORAGE_PREFIX,
  storage: SecureStore,
}) as unknown as BetterAuthClientPlugin;

/**
 * Bearer-token capture + attach — a better-fetch plugin (the exact mechanism the
 * expo plugin above uses). This is the fix for the RN "session expired on every
 * screen" bug: RN's native networking swallows the server's `Set-Cookie`, so the
 * cookie the expo plugin re-attaches is often empty and every api-client request
 * 401s. Better Auth's server-side `bearer()` plugin sidesteps that by echoing the
 * session token in a plain `set-auth-token` response header the RN client CAN
 * read, and by accepting `Authorization: Bearer <token>` on the way back.
 *
 * Two halves:
 *   - `init` attaches `Authorization: Bearer <token>` to every authClient
 *     request, so `useSession`/get-session authenticate via the token even when
 *     the cookie path yields nothing. Runs alongside the expo plugin's own
 *     `init` (which sets the cookie header); they touch different headers.
 *   - `hooks.onSuccess` reads `set-auth-token` off any response that (re)issues a
 *     session (e.g. OTP verify, session refresh) and persists the raw token.
 *
 * Cast like `expoAuthPlugin`: `@better-auth/expo` and better-auth resolve
 * structurally-wider @better-fetch plugin/header types, so this satisfies the
 * interface at runtime but not by inference. Scoped interop cast, NOT `any`.
 */
const bearerTokenPlugin = {
  id: 'bearer-token',
  fetchPlugins: [
    {
      id: 'bearer-token',
      name: 'bearer-token',
      init(url: string, options?: { headers?: Record<string, string> }) {
        const token = SecureStore.getItem(AUTH_TOKEN_STORAGE_KEY);
        const next = options ?? {};
        if (token) {
          next.headers = { ...next.headers, Authorization: `Bearer ${token}` };
        }
        return { url, options: next };
      },
      hooks: {
        onSuccess(context: { response: Response }) {
          const token = context.response.headers.get('set-auth-token');
          if (token) SecureStore.setItem(AUTH_TOKEN_STORAGE_KEY, token);
        },
      },
    },
  ],
} as unknown as BetterAuthClientPlugin;

/**
 * Better Auth client configured for React Native / Expo.
 *
 * React Native has no cookie jar, so the `expoClient` plugin persists the
 * server's Set-Cookie (`better-auth.session_token`) into expo-secure-store and
 * re-injects it as a header on every request. We use the `better-auth/react`
 * entry so `authClient.useSession` is a real React hook (backed by
 * useSyncExternalStore), not a raw nanostores atom.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [expoAuthPlugin, bearerTokenPlugin, phoneNumberClient(), twoFactorClient()],
});

/** Typed React hook: `{ data, isPending, error, ... }`. */
export const useSession = authClient.useSession;

/** Phone-OTP methods from the phoneNumberClient plugin (`sendOtp`, `verify`). */
export const phoneNumberMethods = authClient.phoneNumber;

/**
 * Sign out and clear BOTH persisted credentials — the bearer token and the expo
 * cookie jar. The token is cleared in a `finally` so a signed-out/expired session
 * (whose `/sign-out` network call may itself fail) still ends up with no local
 * credential; this is what makes the global 401 handler self-healing rather than
 * a dead-end.
 */
export const signOut = async (): Promise<void> => {
  try {
    await authClient.signOut();
  } finally {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
  }
};

/**
 * The raw bearer session token, or null when signed out. Persisted by
 * `bearerTokenPlugin` from the server's `set-auth-token` header.
 */
export function getAuthToken(): string | null {
  const token = SecureStore.getItem(AUTH_TOKEN_STORAGE_KEY);
  return token && token.length > 0 ? token : null;
}

/**
 * The `Authorization` header value (`Bearer <token>`) for everything that is not
 * a better-auth call: `@smartshaadi/api-client` sends it as the `Authorization`
 * header and the boot-gate direct fetch reuses it. Null when signed out.
 */
export function getAuthHeader(): string | null {
  const token = getAuthToken();
  return token ? `Bearer ${token}` : null;
}

/**
 * The current session as a complete `Cookie` header string, or null when signed
 * out. FALLBACK ONLY — the bearer token (`getAuthToken`) is the primary
 * credential now (see ADR-002). This remains for the boot-gate direct fetch to
 * try when no token is stored yet (e.g. an app updated in place that still holds
 * a cookie from before the token migration).
 *
 * Read straight from secure storage via the plugin's own exported helper rather
 * than through `authClient.getCookie()`: the plugin instance is cast to
 * `BetterAuthClientPlugin` above (a documented interop workaround), and that
 * cast erases the `getCookie` action from the client's inferred type. Going to
 * the helper keeps this fully typed with no second cast, and reuses the plugin's
 * expiry filtering rather than reimplementing it.
 *
 * Returned VERBATIM — never parsed down to a bare token. The cookie's name
 * differs between environments (`better-auth.session_token` in dev,
 * `__Secure-better-auth.session_token` once the server sets Secure cookies), so
 * anything that rebuilds the name from a token value works in dev and silently
 * fails to authenticate in production.
 */
export function getSessionCookie(): string | null {
  const stored = SecureStore.getItem(COOKIE_STORAGE_KEY);
  if (!stored) return null;
  const cookie = getCookie(stored);
  return cookie.length > 0 ? cookie : null;
}

/**
 * Fetch the current session straight from the server, bypassing the
 * `useSession` React store.
 *
 * The store-backed hook can wedge in a release build — its initial fetch never
 * flips `isPending`, stranding the app on a permanent boot spinner. This is the
 * boot gate's repair path: a plain `fetch` with the persisted credential and a
 * HARD timeout, so a reachable server always yields a definitive answer even when
 * the hook does not. It must never hang — it exists precisely because something
 * upstream already did. Sends the bearer token (the primary credential), falling
 * back to the cookie for a pre-migration app, so its answer agrees with a healthy
 * hook in every case.
 */
export async function fetchSessionDirect(
  timeoutMs: number,
): Promise<{ user: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    const authHeader = getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else {
      const cookie = getSessionCookie();
      if (cookie) headers['Cookie'] = cookie;
    }
    const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: unknown } | null;
    return body?.user ? { user: body.user } : null;
  } finally {
    clearTimeout(timer);
  }
}
