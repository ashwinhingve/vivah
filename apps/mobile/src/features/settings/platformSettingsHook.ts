import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/env';

export interface PlatformSettings {
  lgbtqEnabled: boolean;
  isMockMode: boolean;
}

/**
 * Fetch public platform settings (isMockMode indicator + feature flags).
 * Cached indefinitely by default — fallback EXPO_PUBLIC_MOCK_MODE is used
 * if the endpoint is unreachable.
 */
export function usePlatformSettings() {
  const fallbackMockMode = process.env.EXPO_PUBLIC_MOCK_MODE === 'true';

  return useQuery({
    queryKey: ['platformSettings'],
    queryFn: async (): Promise<PlatformSettings> => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/platform-settings/public`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          return { lgbtqEnabled: false, isMockMode: fallbackMockMode };
        }
        const json = (await res.json()) as { data?: PlatformSettings };
        return json.data ?? { lgbtqEnabled: false, isMockMode: fallbackMockMode };
      } catch {
        // Network error — fall back to env var
        return { lgbtqEnabled: false, isMockMode: fallbackMockMode };
      }
    },
    staleTime: Infinity, // Cache indefinitely — mock mode does not change at runtime
  });
}
