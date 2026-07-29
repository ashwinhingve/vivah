import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';

/** Static insets so `useSafeAreaInsets` (ActionSheet, bottom sheets) works
 *  under test — the native provider never mounts in jest. */
const INITIAL_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

/**
 * Canonical way to render a screen under test.
 *
 * Two rules this encodes, both learned the hard way:
 *
 * 1. MUST be awaited. In @testing-library/react-native v14 `render` is async and
 *    returns no spreadable query object. The global `screen` is not bound until
 *    the promise settles, so calling it synchronously makes the next
 *    `screen.findByText` throw "`render` function has not been called" — which
 *    reads as a component crash when the component simply had not rendered YET.
 *
 * 2. Render SCREENS, not hooks. `renderHook` in this stack yields a
 *    `result.current` that goes null or stale once a second async operation is
 *    involved, producing failures that say nothing about the code under test.
 *    Driving the screen exercises the same hook through the path users take, and
 *    the assertions stay meaningful.
 *
 * The QueryClient is real (not mocked) so query state transitions actually run;
 * `retry: false` keeps an intentionally-failing request from burning the timeout
 * on backoff.
 */
export async function renderScreen(
  ui: ReactElement,
): Promise<{ queryClient: QueryClient; unmount: () => Promise<void> }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        {children}
      </SafeAreaProvider>
    </QueryClientProvider>
  );

  const result = await render(ui, { wrapper });

  // `unmount` is exposed so cleanup behaviour (leaving socket rooms, cancelling
  // subscriptions) can be asserted — that teardown is where realtime screens
  // leak, and it is invisible to any test that never unmounts. Async for the
  // same reason `render` is: effect cleanups have not run when it returns.
  return { queryClient, unmount: async () => { await result.unmount(); } };
}
