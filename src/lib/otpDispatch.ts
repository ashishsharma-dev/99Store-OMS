import crypto from 'crypto';
import type { CampaignProgress } from './walabz';

export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_DISPATCH_TOKEN_MAX_AGE_SECONDS = 2 * 60;

export type OtpDeliveryStatus = 'queued' | 'sent' | 'failed';

interface OtpDispatchTokenPayload {
  version: 1;
  campaignId: string;
  username: string;
  expiresAt: number;
}

let developmentSecret: string | undefined;

function getSigningSecret(): string | undefined {
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

export function buildLoginOtpVariableMappings(otp: string): Record<string, string> {
  return { '1': otp };
}

export function getOtpResendCooldownSeconds(lastIssuedAt: string | undefined, now = Date.now()): number {
  if (!lastIssuedAt) return 0;
  const issuedAt = Date.parse(lastIssuedAt);
  if (!Number.isFinite(issuedAt)) return 0;
  return Math.max(0, Math.ceil((issuedAt + OTP_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000));
}

export function summarizeOtpCampaignProgress(progress: CampaignProgress): OtpDeliveryStatus {
  const status = String(progress.status || '').toLowerCase();
  if (status === 'failed') return 'failed';
  if (
    status === 'completed' ||
    Number(progress.sent || 0) > 0 ||
    Number(progress.delivered || 0) > 0 ||
    Number(progress.read || 0) > 0
  ) {
    return 'sent';
  }
  return 'queued';
}

export async function waitForOtpCampaignStatus(
  getProgress: () => Promise<CampaignProgress>,
  attempts = 3,
  delayMs = 750,
): Promise<OtpDeliveryStatus> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const status = summarizeOtpCampaignProgress(await getProgress());
      if (status !== 'queued') return status;
    } catch {
      return 'queued';
    }
    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return 'queued';
}

export function createOtpDispatchToken(campaignId: string, username: string, now = Date.now()): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error('AUTH_SESSION_SECRET must be configured in production.');
  const payload: OtpDispatchTokenPayload = {
    version: 1,
    campaignId,
    username,
    expiresAt: now + OTP_DISPATCH_TOKEN_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyOtpDispatchToken(
  token: string | undefined,
  now = Date.now(),
): OtpDispatchTokenPayload | null {
  const secret = getSigningSecret();
  if (!secret || !token) return null;
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra || !safeEqual(signature, sign(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(decode(encodedPayload)) as OtpDispatchTokenPayload;
    if (
      payload.version !== 1 ||
      !payload.campaignId ||
      !payload.username ||
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
