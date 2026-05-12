import { NextRequest, NextResponse } from 'next/server';
import { hasSessionCookie } from '@/lib/auth/session-cookie';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    pathname.startsWith('/vendor')
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

    // Redirect /dashboard to the correct role dashboard
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
  } else if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/register')
  ) {
    const hasCookie = hasSessionCookie(request.cookies);
    if (hasCookie) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else if (pathname.startsWith('/account/recovery')) {
    if (!hasSessionCookie(request.cookies)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/vendor-dashboard/:path*',
    '/admin/:path*',
    '/support/:path*',
    '/feed/:path*',
    '/vendors/:path*',
    '/vendor/:path*',
    '/bookings/:path*',
    '/chat/:path*',
    '/matches/:path*',
    '/profile/:path*',
    '/wedding/:path*',
    '/weddings/:path*',
    '/payments/:path*',
    '/likes/:path*',
    '/shortlist/:path*',
    '/requests/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/pricing',
    '/store/:path*',
    '/rentals/:path*',
    '/viewers/:path*',
    '/coordinator/:path*',
    '/family/:path*',
    '/login',
    '/verify',
    '/register',
    '/account/recovery',
  ],
};
