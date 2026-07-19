import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

/**
 * Render a screen inside a REAL React Query provider.
 *
 * The provider is real on purpose. An earlier version of these tests mocked
 * `useInfiniteQuery` wholesale and then asserted that a `jest.fn()` returned
 * what it had been told to return — the screen was never imported, never
 * rendered, and gutting it left every test green. Driving the actual query
 * machinery is what makes the assertions mean anything.
 *
 * `retry: false` so an intentionally-failing request surfaces immediately
 * instead of burning the test timeout on backoff.
 */
export async function renderWithQuery(
  ui: ReactElement,
): Promise<{ queryClient: QueryClient }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  // MUST be awaited. In @testing-library/react-native v14 `render` is async and
  // returns no spreadable query object — the screen-scoped queries are reached
  // through the global `screen`, which is not bound until this promise settles.
  // Calling it synchronously makes the very next `screen.findByText` throw
  // "`render` function has not been called", which reads like the component
  // failed to render when in fact it simply had not rendered YET.
  await render(ui, { wrapper });

  return { queryClient };
}

/** A MatchFeedItem fixture. Values here are what assertions look for on screen. */
export function feedItem(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 'profile-1',
    name: 'Alice Johnson',
    age: 28,
    city: 'Mumbai',
    compatibility: {
      totalScore: 85,
      breakdown: {
        demographicAlignment: { score: 18, max: 20 },
        lifestyleCompatibility: { score: 12, max: 15 },
        careerEducation: { score: 14, max: 15 },
        familyValues: { score: 13, max: 15 },
        preferenceOverlap: { score: 18, max: 20 },
        personalityFit: { score: 10, max: 15 },
      },
      gunaScore: 28,
      tier: 'excellent',
      flags: [],
    },
    photoKey: 'photo-1',
    isNew: true,
    isVerified: true,
    photoHidden: false,
    shortlisted: false,
    ...overrides,
  };
}
