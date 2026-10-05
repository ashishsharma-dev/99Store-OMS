import crypto from 'crypto';

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWebhookSignature(rawBody: string, headers: Headers, secret?: string): boolean {
  const configuredSecret = secret?.trim();
  if (!configuredSecret) {
    return process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true';
  }

  const suppliedToken = headers.get('x-webhook-token')?.trim();
  if (suppliedToken && safeEqual(suppliedToken, configuredSecret)) return true;

  const suppliedSignature = headers.get('x-webhook-signature')?.trim().replace(/^sha256=/i, '');
  if (!suppliedSignature) return false;
  const expected = crypto.createHmac('sha256', configuredSecret).update(rawBody).digest('hex');
  return safeEqual(suppliedSignature.toLowerCase(), expected);
}
