import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLoginOtpVariableMappings,
  createOtpDispatchToken,
  getOtpResendCooldownSeconds,
  summarizeOtpCampaignProgress,
  verifyOtpDispatchToken,
  waitForOtpCampaignStatus,
} from '../src/lib/otpDispatch';

const originalSessionSecret = process.env.AUTH_SESSION_SECRET;

before(() => {
  process.env.AUTH_SESSION_SECRET = 'test-otp-dispatch-secret-with-sufficient-entropy';
});

after(() => {
  if (originalSessionSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = originalSessionSecret;
});

describe('login OTP dispatch safeguards', () => {
  it('maps an authentication OTP only to template variable 1', () => {
    assert.deepEqual(buildLoginOtpVariableMappings('482913'), { '1': '482913' });
  });

  it('enforces a 30-second resend cooldown', () => {
    const issuedAt = new Date(10_000).toISOString();
    assert.equal(getOtpResendCooldownSeconds(issuedAt, 10_000), 30);
    assert.equal(getOtpResendCooldownSeconds(issuedAt, 25_001), 15);
    assert.equal(getOtpResendCooldownSeconds(issuedAt, 40_000), 0);
  });

  it('signs short-lived campaign status tokens and rejects tampering', () => {
    const token = createOtpDispatchToken('campaign-1', 'admin', 1_000);
    assert.equal(verifyOtpDispatchToken(token, 2_000)?.campaignId, 'campaign-1');
    assert.equal(verifyOtpDispatchToken(`${token.slice(0, -1)}x`, 2_000), null);
    assert.equal(verifyOtpDispatchToken(token, 121_001), null);
  });

  it('distinguishes queued, sent, and failed provider states', async () => {
    assert.equal(summarizeOtpCampaignProgress({ status: 'preparing', sent: 0 }), 'queued');
    assert.equal(summarizeOtpCampaignProgress({ status: 'processing', sent: 1 }), 'sent');
    assert.equal(summarizeOtpCampaignProgress({ status: 'failed', sent: 0 }), 'failed');

    let checks = 0;
    const finalStatus = await waitForOtpCampaignStatus(async () => {
      checks += 1;
      return checks === 1 ? { status: 'preparing' } : { status: 'failed' };
    }, 3, 0);
    assert.equal(finalStatus, 'failed');
    assert.equal(checks, 2);
  });
});
