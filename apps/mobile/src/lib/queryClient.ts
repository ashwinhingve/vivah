import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@smartshaadi/api-client';

/**
 * Shared React Query client.
 *
 * Defaults are tuned for a phone on Indian mobile data, which is the target
 * device profile — not a desktop on wifi.
 */
export const queryClient = new QueryClient({
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
