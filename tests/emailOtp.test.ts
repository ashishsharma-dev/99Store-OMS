import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, sendLoginEmailOtp } from '../src/lib/resend';

describe('Resend Email OTP functionality', () => {
  it('correctly masks email addresses for privacy', () => {
    assert.equal(maskEmail('shivaynew66@gmail.com'), 'sh********6@gmail.com');
    assert.equal(maskEmail('admin@example.com'), 'ad**n@example.com');
    assert.equal(maskEmail('ab@domain.com'), 'a*@domain.com');
    assert.equal(maskEmail(''), '');
  });

  it('rejects dispatch when API key is missing', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      const result = await sendLoginEmailOtp('test@example.com', '123456', { resendApiKey: '' });
      assert.equal(result.success, false);
      assert.match(result.error || '', /Resend API key is not configured/);
    } finally {
      if (originalKey) process.env.RESEND_API_KEY = originalKey;
    }
  });

  it('rejects invalid email formats', async () => {
    const result = await sendLoginEmailOtp('not-an-email', '123456', { resendApiKey: 're_test_123' });
    assert.equal(result.success, false);
    assert.match(result.error || '', /Invalid destination email/);
  });

  it('sends email OTP with proper payload to Resend API', async () => {
    const originalFetch = globalThis.fetch;
    let interceptedUrl: string | undefined;
    let interceptedHeaders: Record<string, string> | undefined;
    let interceptedBody: any;

    globalThis.fetch = async (input, init) => {
      interceptedUrl = String(input);
      interceptedHeaders = init?.headers as Record<string, string>;
      interceptedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: 'msg_resend_mock_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const result = await sendLoginEmailOtp('admin@ayurvedacare.store', '987654', {
        resendApiKey: 're_live_secret_key',
        fromEmail: 'Custom OMS <auth@ayurvedacare.store>',
      });

      assert.equal(result.success, true);
      assert.equal(result.id, 'msg_resend_mock_123');
      assert.equal(interceptedUrl, 'https://api.resend.com/emails');
      assert.equal(interceptedHeaders?.['Authorization'], 'Bearer re_live_secret_key');
      assert.equal(interceptedBody?.from, 'Custom OMS <auth@ayurvedacare.store>');
      assert.deepEqual(interceptedBody?.to, ['admin@ayurvedacare.store']);
      assert.match(interceptedBody?.subject, /987654/);
      assert.match(interceptedBody?.html, /987654/);
      assert.match(interceptedBody?.text, /987654/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles API error responses gracefully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        name: 'validation_error',
        message: 'You can only send testing emails to your own email address.',
        statusCode: 403,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const result = await sendLoginEmailOtp('unverified@example.com', '123456', {
        resendApiKey: 're_test',
      });
      assert.equal(result.success, false);
      assert.match(result.error || '', /You can only send testing emails/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
