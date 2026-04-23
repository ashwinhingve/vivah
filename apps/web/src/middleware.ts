import { NextRequest, NextResponse } from 'next/server';
import { hasSessionCookie } from '@/lib/auth/session-cookie';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/vendor-dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/feed') ||
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/matches') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/wedding')
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
        return NextResponse.redirect(new URL('/login', request.url));
      }
      // API down but cookie exists — let request through, page will handle auth
      return NextResponse.next();
    }

    // Guard role-specific dashboards against wrong roles
    if (pathname.startsWith('/vendor-dashboard') && role !== 'VENDOR') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/admin') && role !== 'ADMIN' && role !== 'SUPPORT') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Redirect /dashboard to the correct role dashboard
    if (pathname === '/dashboard' && role === 'VENDOR') {
      return NextResponse.redirect(new URL('/vendor-dashboard', request.url));
    }
    if (pathname === '/dashboard' && (role === 'ADMIN' || role === 'SUPPORT')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  } else if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/register')
  ) {
    const hasCookie = hasSessionCookie(request.cookies);
    if (hasCookie) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/vendor-dashboard/:path*',
    '/admin/:path*',
    '/feed/:path*',
    '/vendors/:path*',
    '/bookings/:path*',
    '/chat/:path*',
    '/matches/:path*',
    '/profile/:path*',
    '/wedding/:path*',
    '/login',
    '/verify',
    '/register',
  ],
};
