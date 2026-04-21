import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

/**
 * Server-component helper for authenticated API calls.
 * Reads the Better Auth session cookie and forwards it to the API.
 *
 * Returns the unwrapped `data` payload, or `null` on any of:
 *   - missing cookie
 *   - non-2xx response
 *   - envelope `success: false`
 *   - network / parse errors
 *
 * Callers should handle `null` as an empty/error state in the UI.
 */
export async function fetchAuth<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
