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
  plugins: [expoAuthPlugin, phoneNumberClient(), twoFactorClient()],
});

/** Typed React hook: `{ data, isPending, error, ... }`. */
export const useSession = authClient.useSession;

/** Phone-OTP methods from the phoneNumberClient plugin (`sendOtp`, `verify`). */
export const phoneNumberMethods = authClient.phoneNumber;

/** Sign out and clear the persisted session cookie. */
export const signOut = () => authClient.signOut();

/**
 * The current session as a complete `Cookie` header string, or null when signed
 * out. This is the credential for EVERYTHING that is not a better-auth call:
 * `@smartshaadi/api-client` sends it as the `Cookie` header, and the Socket.io
 * handshake sends it as `auth.cookie`.
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
