import { NextResponse } from 'next/server';
import {
  isSuperAdminRecoveryEnabled,
  verifySuperAdminRecoverySecret,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { clearRateLimit, consumeRateLimit, getClientIp } from '@/lib/rateLimit';
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session';

const RECOVERY_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSuperAdminRecoveryEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = `superadmin-recovery:${clientIp}`;
  const rateLimit = consumeRateLimit(rateLimitKey, 5, RECOVERY_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many recovery attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  let recoverySecret = '';
  try {
    const body = await request.json();
    recoverySecret = typeof body?.recoverySecret === 'string' ? body.recoverySecret : '';
  } catch {
    // Use the same response as an incorrect secret to avoid leaking endpoint details.
  }

  if (!verifySuperAdminRecoverySecret(recoverySecret)) {
    return NextResponse.json({ error: 'Invalid recovery credentials.' }, { status: 401 });
  }

  const preferredUsername = process.env.SUPERADMIN_RECOVERY_USERNAME?.trim().toLowerCase();
  const users = await db.getUsers();
  const user = users.find(candidate => (
    candidate.isActive
    && candidate.role === 'Super Admin'
    && (!preferredUsername || candidate.username.toLowerCase() === preferredUsername)
  ));

  if (!user) {
    return NextResponse.json({ error: 'No eligible Super Admin account is configured.' }, { status: 409 });
  }

  clearRateLimit(rateLimitKey);
  console.warn(`[AUTH] Super Admin recovery login used for ${user.username} from ${clientIp}.`);
  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions());
  return response;
}
