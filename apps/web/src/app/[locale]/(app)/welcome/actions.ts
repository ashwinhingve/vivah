'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const WELCOME_COOKIE = 'welcome_seen';

export async function markWelcomeSeen() {
  const c = await cookies();
  c.set(WELCOME_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/feed');
}
