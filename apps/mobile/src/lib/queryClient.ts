import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ApiRequestError } from '@smartshaadi/api-client';
import { signOut } from './auth-client';

/**
 * Recover from a genuinely expired/invalid session.
 *
 * A 401 on ANY query means the credential is dead — clear it and send the user
 * to sign-in rather than leaving them staring at "Your session has expired." on
 * a tab they can't escape (the `(app)` shell has no auth re-guard). This is what
 * makes the error self-healing; it also rescues an app that was updated in place
 * and still holds a stale pre-bearer-token session.
 *
 * `handling` guards against the thundering herd: several screens' queries fail
 * with 401 at once, but we sign out and redirect exactly once. `router.replace`
 * is idempotent besides, and after `signOut` the token is gone so refires are
 * harmless. Reset in `finally` so a later re-login that expires again is handled.
 */
let handlingUnauthorized = false;
async function handleUnauthorized(): Promise<void> {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  try {
    await signOut();
    router.replace('/(auth)/phone');
  } finally {
    handlingUnauthorized = false;
  }
}

/**
 * Shared React Query client.
 *
 * Defaults are tuned for a phone on Indian mobile data, which is the target
 * device profile — not a desktop on wifi.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiRequestError && error.isUnauthorized) {
        void handleUnauthorized();
      }
    },
  }),
  // Mutations can 401 too (e.g. sending a match request after the session
  // expired) — same recovery so no write is a dead-end either.
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ApiRequestError && error.isUnauthorized) {
        void handleUnauthorized();
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Data here is social, not financial: a slightly stale feed is fine, and
      // refetching on every screen focus burns metered data for no benefit.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Never retry a request the server has definitively rejected. Retrying a
        // 401 hammers the API while the user waits on a spinner that will never
        // resolve; 403/404/422 are equally final.
        if (error instanceof ApiRequestError) {
          if (error.httpStatus >= 400 && error.httpStatus < 500) return false;
        }
        return failureCount < 2;
      },
      // The RN bridge has no window focus; refetch-on-focus is wired through
      // AppState by the screens that actually want it.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations are user-initiated and often non-idempotent (sending a match
      // request twice creates confusion). Surface the failure and let the user
      // decide instead of silently retrying.
      retry: false,
    },
  },
});
