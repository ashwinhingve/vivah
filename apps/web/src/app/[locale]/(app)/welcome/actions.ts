'use server';

import { cookies } from 'next/headers';

const WELCOME_COOKIE = 'welcome_seen';

/**
 * Sets the one-time welcome cookie. Deliberately does NOT redirect: a
 * server-side redirect('/feed') in the same response raced the middleware
 * welcome gate (the redirected render didn't yet see the cookie), which made
 * the CTA a no-op — the long-standing "button doesn't reliably work" bug the
 * e2e helpers worked around. The client CTA awaits this action (so the browser
 * has the Set-Cookie) and then navigates.
 */
export async function markWelcomeSeen() {
  const c = await cookies();
  c.set(WELCOME_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
}
