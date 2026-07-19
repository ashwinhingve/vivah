import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

/**
 * Render a screen inside a REAL React Query provider — same rationale as the
 * matches test utils: mocking the query hooks would leave the screen unimported
 * and the assertions meaningless.
 */
export async function renderWithQuery(ui: ReactElement): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  // Must be awaited — RNTL v14's render is async and `screen` is not bound
  // until it settles.
  await render(ui, { wrapper });
}

/** A VendorProfile fixture. Values here are what assertions look for. */
export function vendorFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vendor-1',
    businessName: 'Rajwada Palace',
    category: 'VENUE',
    city: 'Jaipur',
    state: 'Rajasthan',
    rating: 4.6,
    totalReviews: 32,
    verified: true,
    services: [],
    portfolioKey: null,
    tagline: 'Heritage courtyard weddings',
    description: null,
    priceMin: 250000,
    priceMax: 800000,
    isFavorite: false,
    ...overrides,
  };
}
