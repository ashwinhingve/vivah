import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { hasSessionCookie } from '@/lib/auth/session-cookie';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/vendor-dashboard',
  '/admin',
  '/support',
  '/feed',
  '/vendors',
  '/vendor',
  '/bookings',
  '/chat',
  '/matches',
  '/profile',
  '/wedding',
  '/weddings',
  '/payments',
  '/likes',
  '/shortlist',
  '/requests',
  '/notifications',
  '/settings',
  '/pricing',
  '/store',
  '/rentals',
  '/viewers',
  '/coordinator',
  '/family',
] as const;

const GUEST_ONLY_PREFIXES = ['/login', '/verify', '/register'] as const;

function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(en|hi)(?=\/|$)/, '') || '/';
}

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest) {
  // 1. Run locale routing first. If next-intl issues a redirect (unknown
  //    locale, prefix normalisation), honor it before our auth logic.
  const intlResponse = intlMiddleware(request);
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const pathname = stripLocale(request.nextUrl.pathname);

  if (PROTECTED_PREFIXES.some((p) => hasPrefix(pathname, p))) {
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
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return intlResponse;
    }

    if (pathname.startsWith('/vendor-dashboard') && role !== 'VENDOR') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/support') && role !== 'SUPPORT' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/coordinator') && role !== 'EVENT_COORDINATOR' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/family') && role !== 'FAMILY_MEMBER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (pathname === '/dashboard' && role === 'VENDOR') {
      return NextResponse.redirect(new URL('/vendor-dashboard', request.url));
    }
    if (pathname === '/dashboard' && role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (pathname === '/dashboard' && role === 'SUPPORT') {
      return NextResponse.redirect(new URL('/support', request.url));
    }
    if (pathname === '/dashboard' && role === 'EVENT_COORDINATOR') {
      return NextResponse.redirect(new URL('/coordinator', request.url));
    }
    if (pathname === '/dashboard' && role === 'FAMILY_MEMBER') {
      return NextResponse.redirect(new URL('/family', request.url));
    }
  } else if (GUEST_ONLY_PREFIXES.some((p) => hasPrefix(pathname, p))) {
    if (hasSessionCookie(request.cookies)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else if (pathname.startsWith('/account/recovery')) {
    if (!hasSessionCookie(request.cookies)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
