import crypto from 'crypto';

const DEFAULT_PUBLIC_APP_URL = 'https://oms.ayurvedacare.store';
const DEFAULT_MEDIA_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.PACKING_SLIP_MEDIA_SECRET || process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PACKING_SLIP_MEDIA_SECRET or AUTH_SESSION_SECRET must be at least 32 characters.');
  }
  return secret;
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost', '0.0.0.0', '::1'].includes(normalized)) return true;
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) return true;

  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

export function normalizePublicAppUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || isPrivateHostname(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolvePublicAppUrl(requestBaseUrl?: string): string {
  return normalizePublicAppUrl(process.env.APP_PUBLIC_URL)
    || normalizePublicAppUrl(process.env.NEXT_PUBLIC_APP_URL)
    || normalizePublicAppUrl(requestBaseUrl)
    || DEFAULT_PUBLIC_APP_URL;
}

function sign(orderId: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${orderId}.${expiresAt}`)
    .digest('base64url');
}

export function createPackingSlipMediaUrl(
  orderId: string,
  requestBaseUrl?: string,
  now = Date.now(),
  ttlMs = DEFAULT_MEDIA_TTL_MS,
): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) throw new Error('Invalid order ID for packing-slip media.');
  const expiresAt = now + ttlMs;
  const url = new URL(`/api/media/packing-slip/${encodeURIComponent(orderId)}`, resolvePublicAppUrl(requestBaseUrl));
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('token', sign(orderId, expiresAt));
  return url.toString();
}

export function verifyPackingSlipMediaToken(
  orderId: string,
  expiresValue: string | null,
  token: string | null,
  now = Date.now(),
): boolean {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId) || !expiresValue || !token) return false;
  const expiresAt = Number(expiresValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = Buffer.from(sign(orderId, expiresAt));
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
