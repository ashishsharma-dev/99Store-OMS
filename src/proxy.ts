import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/health',
  '/api/track',
  '/api/webhooks/',
  '/api/integrations/courier/webhook',
  '/api/integrations/courier/shadowfax/webhook',
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.delete('x-user-role');
  headers.delete('x-auth-user-id');
  headers.delete('x-auth-username');
  headers.delete('x-auth-role');
  headers.set('x-auth-user-id', session.userId);
  headers.set('x-auth-username', session.username);
  headers.set('x-auth-role', session.role);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/dashboard/:path*', '/packing-slip/:path*', '/api/:path*'],
};
