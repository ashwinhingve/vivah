// Better Auth auto-prefixes cookies with `__Secure-` when `secure: true`
// (production over HTTPS). The prefix is part of the actual cookie name the
// browser stores, so any server-side code forwarding the cookie to the API
// must preserve that exact name.

const SECURE_NAME = '__Secure-better-auth.session_token';
const PLAIN_NAME = 'better-auth.session_token';

type ReadonlyStore = {
  get(name: string): { name: string; value: string } | undefined;
};

type HasStore = {
  has(name: string): boolean;
};

// Prefer the plain name because the API now sets `useSecureCookies: false`.
// The secure-prefixed lookup is kept only to handle stale cookies left over
// from an older deploy; those should be cleared on next login.
export function readSessionCookie(
  store: ReadonlyStore,
): { name: string; value: string } | null {
  return store.get(PLAIN_NAME) ?? store.get(SECURE_NAME) ?? null;
}

export function hasSessionCookie(store: HasStore): boolean {
  return store.has(PLAIN_NAME) || store.has(SECURE_NAME);
}
