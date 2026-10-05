import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createSessionToken,
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/session';

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const user = await db.getUserByUsername(session.username);
  if (!user || !user.isActive || user.id !== session.userId) {
    const response = NextResponse.json({ error: 'Session is no longer valid.' }, { status: 401 });
    response.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions());
  return response;
}
