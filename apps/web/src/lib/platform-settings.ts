import { cache } from 'react';
import { API_URL } from './api-url';

export interface PlatformSettings {
  lgbtqEnabled: boolean;
  isMockMode: boolean;
}

/**
 * Fetch public platform settings. Cached per request using React's cache()
 * so multiple components in the same render cycle don't trigger duplicate network calls.
 * No auth required.
 */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const res = await fetch(`${API_URL}/api/v1/platform-settings/public`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return { lgbtqEnabled: false, isMockMode: false };
    }
    const json = (await res.json()) as { data?: PlatformSettings };
    return json.data ?? { lgbtqEnabled: false, isMockMode: false };
  } catch {
    return { lgbtqEnabled: false, isMockMode: false };
  }
});
