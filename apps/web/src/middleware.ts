import { type NextRequest, NextResponse } from 'next/server';

// Routes that require an active session
const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/matches', '/bookings', '/wedding'];
// Routes only for unauthenticated users
const AUTH_ROUTES = ['/login', '/verify', '/register'];

// Better Auth session cookie name (default)
const SESSION_COOKIE = 'better-auth.session_token';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // No session + trying to access protected route → redirect to login
  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Has session + trying to access auth route → redirect to dashboard
  if (isAuthRoute && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
