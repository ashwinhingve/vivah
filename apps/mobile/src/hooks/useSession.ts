/**
 * Auth session hook. Re-exports the typed `useSession` hook from the Better
 * Auth react client (backed by useSyncExternalStore) so screens import it from
 * a stable `hooks/` path. Returns `{ data, isPending, error, ... }`.
 */
export { useSession } from '../lib/auth-client';
