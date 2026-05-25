import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { hasSessionCookie } from '@/lib/auth/session-cookie';

const intlMiddleware = createIntlMiddleware(routing);

// Strip the leading locale segment so existing path-prefix checks still match.
// `/hi/feed` → `/feed`, `/en/feed` → `/feed`, `/feed` → `/feed`, `/hi` → `/`.
function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(en|hi)(\/.*|$)/);
  if (!m) return pathname;
  return m[2] || '/';
}

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  // If next-intl issued a redirect (e.g. /en/foo → /foo under 'as-needed'),
  // honor it without re-running auth — the follow-up request goes through
  // this middleware again on the canonical URL.
  if (intlResponse.headers.get('location')) {
    return intlResponse;
  }

  const rawPathname = request.nextUrl.pathname;
  const pathname = stripLocale(rawPathname);
  const localeMatch = rawPathname.match(/^\/(en|hi)(\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : '';

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/vendor-dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/feed') ||
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/matches') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/wedding') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/likes') ||
    pathname.startsWith('/shortlist') ||
    pathname.startsWith('/requests') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/rentals') ||
    pathname.startsWith('/viewers') ||
    pathname.startsWith('/coordinator') ||
    pathname.startsWith('/family') ||
    pathname.startsWith('/weddings') ||
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/welcome')
  ) {
    let role = 'INDIVIDUAL';
    let sessionOk = false;

    try {
      const sessionRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/get-session`,
        {
          headers: { cookie: request.headers.get('cookie') ?? '' },
          cache: 'no-store',
        },
      );

      if (sessionRes.ok) {
        const body = (await sessionRes.json()) as { user?: { role?: string } };
        if (body?.user) {
          role = body.user.role ?? 'INDIVIDUAL';
          sessionOk = true;
        }
      }
    } catch {
      // API unreachable — fall back to cookie check so users aren't kicked out
    }

    if (!sessionOk) {
      const hasCookie = hasSessionCookie(request.cookies);
      if (!hasCookie) {
        return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
      }
      // API down but cookie exists — let request through, page will handle auth.
      // Return intlResponse (not NextResponse.next()) to preserve next-intl headers.
      return intlResponse;
    }

    // Guard role-specific dashboards against wrong roles
    if (pathname.startsWith('/vendor-dashboard') && role !== 'VENDOR') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
    if (pathname.startsWith('/support') && role !== 'SUPPORT' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
    if (pathname.startsWith('/coordinator') && role !== 'EVENT_COORDINATOR' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
    if (pathname.startsWith('/family') && role !== 'FAMILY_MEMBER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }

    // Gate /dashboard and /feed behind a one-time /welcome step (INDIVIDUAL only).
    // Cookie set by markWelcomeSeen Server Action — once seen, never re-routes.
    const welcomeSeen = request.cookies.get('welcome_seen')?.value === '1';
    if (
      role === 'INDIVIDUAL' &&
      !welcomeSeen &&
      !pathname.startsWith('/welcome') &&
      (pathname === '/dashboard' || pathname.startsWith('/feed'))
    ) {
      return NextResponse.redirect(new URL(`${localePrefix}/welcome`, request.url));
    }

    // Redirect /dashboard to the correct role dashboard
    if (pathname === '/dashboard' && role === 'VENDOR') {
      return NextResponse.redirect(new URL(`${localePrefix}/vendor-dashboard`, request.url));
    }
    if (pathname === '/dashboard' && role === 'ADMIN') {
      return NextResponse.redirect(new URL(`${localePrefix}/admin`, request.url));
    }
    if (pathname === '/dashboard' && role === 'SUPPORT') {
      return NextResponse.redirect(new URL(`${localePrefix}/support`, request.url));
    }
    if (pathname === '/dashboard' && role === 'EVENT_COORDINATOR') {
      return NextResponse.redirect(new URL(`${localePrefix}/coordinator`, request.url));
    }
    if (pathname === '/dashboard' && role === 'FAMILY_MEMBER') {
      return NextResponse.redirect(new URL(`${localePrefix}/family`, request.url));
    }
  } else if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/register')
  ) {
    const hasCookie = hasSessionCookie(request.cookies);
    if (hasCookie) {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
  } else if (pathname.startsWith('/account/recovery')) {
    if (!hasSessionCookie(request.cookies)) {
      return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
    }
  }

  return intlResponse;
}

export const config = {
  // Catch every non-asset, non-internal path. No /api exclusion needed —
  // this project has zero route handlers under app/. Matches `/` so the
  // root URL also flows through next-intl (which sets the locale header).
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
