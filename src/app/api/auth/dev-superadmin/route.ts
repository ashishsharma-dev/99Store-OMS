import { NextResponse } from 'next/server';
import { isSuperAdminBypassEnabled } from '@/lib/auth';
import { db } from '@/lib/db';
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session';

export async function POST() {
  if (!isSuperAdminBypassEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const preferredUsername = process.env.DEV_SUPERADMIN_USERNAME?.trim().toLowerCase();
  const users = await db.getUsers();
  const user = users.find(candidate => (
    candidate.isActive
    && candidate.role === 'Super Admin'
    && (!preferredUsername || candidate.username.toLowerCase() === preferredUsername)
  ));

  if (!user) {
    return NextResponse.json(
      {
        error: preferredUsername
          ? `No active Super Admin account matches DEV_SUPERADMIN_USERNAME (${preferredUsername}).`
          : 'No active Super Admin account is available for the development bypass.',
      },
      { status: 409 },
    );
  }

  console.warn(`[AUTH] Development Super Admin bypass used for ${user.username}.`);
  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions());
  return response;
}
