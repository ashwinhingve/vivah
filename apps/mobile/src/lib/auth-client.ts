import { createAuthClient } from 'better-auth/react';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { phoneNumberClient, twoFactorClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './env';

// `@better-auth/expo` builds its expoClient plugin against a bundled copy of
// @better-fetch, whose `fetchPlugins`/headers types are structurally wider than
// the ones better-auth's `BetterAuthClientPlugin` expects. The values are
// runtime-compatible (same package, same version 1.6.2) — only the emitted
// declaration types diverge — so we assert the one plugin to the interface it
// satisfies. This is a scoped interop cast, NOT `any`: every other plugin in the
// array keeps full inference (phoneNumber methods + session user fields stay typed).
const expoAuthPlugin = expoClient({
  scheme: 'smartshaadi',
  storagePrefix: 'smartshaadi',
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
