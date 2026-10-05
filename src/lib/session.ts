import crypto from 'crypto';
import type { User, UserRole } from './types';

export const SESSION_COOKIE_NAME = '99store_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface AuthSession {
  version: 1;
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
}

let developmentSecret: string | undefined;

function getSessionSecret(): string | undefined {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return undefined;
  developmentSecret ||= crypto.randomBytes(32).toString('hex');
  return developmentSecret;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(encodedPayload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(user: Pick<User, 'id' | 'username' | 'name' | 'role'>, now = Date.now()): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET must be configured in production.');
  }

  const payload: AuthSession = {
    version: 1,
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): AuthSession | null {
  const secret = getSessionSecret();
  if (!secret || !token) return null;
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra || !safeEqual(signature, sign(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(decode(encodedPayload)) as AuthSession;
    if (
      payload.version !== 1 ||
      !payload.userId ||
      !payload.username ||
      !payload.role ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): AuthSession | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  return verifySessionToken(token ? decodeURIComponent(token) : undefined);
}

export function hasAllowedRole(session: AuthSession, roles: UserRole[]): boolean {
  return roles.includes(session.role);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: 'high' as const,
  };
}

export function publicSessionUser(session: AuthSession) {
  return {
    id: session.userId,
    username: session.username,
    name: session.name,
    role: session.role,
  };
}
