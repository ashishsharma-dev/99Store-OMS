import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOtp, verifyOtp, verifyPassword, hashPassword } from '../src/lib/auth';
import { consumeRateLimit, clearRateLimit, getClientIp } from '../src/lib/rateLimit';
import {
  createSessionToken,
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '../src/lib/session';
import { verifyWebhookSignature } from '../src/lib/webhookSecurity';

const originalSessionSecret = process.env.AUTH_SESSION_SECRET;
const originalUnsignedSetting = process.env.ALLOW_UNSIGNED_WEBHOOKS;

before(() => {
  process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-sufficient-entropy';
});

after(() => {
  if (originalSessionSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = originalSessionSecret;
  if (originalUnsignedSetting === undefined) delete process.env.ALLOW_UNSIGNED_WEBHOOKS;
  else process.env.ALLOW_UNSIGNED_WEBHOOKS = originalUnsignedSetting;
});

describe('authentication security', () => {
  const user = { id: 'usr-test', username: 'tester', name: 'Tester', role: 'Super Admin' as const };

  it('creates, verifies, and reads a signed session cookie', () => {
    const now = Date.now();
    const token = createSessionToken(user, now);
    const session = verifySessionToken(token, now + 1_000);
    assert.equal(session?.username, 'tester');
    assert.equal(session?.role, 'Super Admin');

    const request = new Request('http://localhost/api/orders', {
      headers: { cookie: `other=value; ${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
    });
    assert.equal(getSessionFromRequest(request)?.userId, 'usr-test');
  });

  it('rejects tampered and expired session tokens', () => {
    const token = createSessionToken(user, 1_000);
    assert.equal(verifySessionToken(`${token.slice(0, -1)}x`, 2_000), null);
    assert.equal(verifySessionToken(token, 1_000 + 8 * 60 * 60 * 1000), null);
  });

  it('generates six-digit OTPs and compares secrets safely', () => {
    const otp = generateOtp();
    assert.match(otp, /^\d{6}$/);
    assert.equal(verifyOtp(otp, otp), true);
    assert.equal(verifyOtp(otp, '000000'), false);
    assert.equal(verifyPassword('correct horse', hashPassword('correct horse')), true);
    assert.equal(verifyPassword('wrong', hashPassword('correct horse')), false);
  });
});

describe('request abuse controls', () => {
  it('limits repeated requests within a window and resets afterward', () => {
    const key = 'security-test-rate-limit';
    clearRateLimit(key);
    assert.equal(consumeRateLimit(key, 2, 1_000, 100).allowed, true);
    assert.equal(consumeRateLimit(key, 2, 1_000, 200).allowed, true);
    assert.equal(consumeRateLimit(key, 2, 1_000, 300).allowed, false);
    assert.equal(consumeRateLimit(key, 2, 1_000, 1_101).allowed, true);
  });

  it('uses the first forwarded address as the client IP', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
    });
    assert.equal(getClientIp(request), '203.0.113.10');
  });
});

describe('webhook signatures', () => {
  it('accepts a valid HMAC and rejects an invalid signature', () => {
    const body = JSON.stringify({ awb: 'ABC123', status: 'Delivered' });
    const secret = 'courier-test-secret';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    assert.equal(verifyWebhookSignature(body, new Headers({ 'x-webhook-signature': `sha256=${signature}` }), secret), true);
    assert.equal(verifyWebhookSignature(body, new Headers({ 'x-webhook-signature': 'bad' }), secret), false);
  });

  it('rejects unsigned callbacks by default', () => {
    delete process.env.ALLOW_UNSIGNED_WEBHOOKS;
    assert.equal(verifyWebhookSignature('{}', new Headers()), false);
  });
});
