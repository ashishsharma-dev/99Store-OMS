import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { WhatsAppLog } from '../src/lib/types';
import { assertExpectedTemplateCategory, getOutboxRetryAt, isWalabzQueueBlocked } from '../src/lib/whatsappQueue';

function log(overrides: Partial<WhatsAppLog>): WhatsAppLog {
  return {
    id: 'test', timestamp: '2026-11-04T05:00:00.000Z', phone: '918439762192',
    type: 'Primary', message: 'test', status: 'Queued', ...overrides,
  };
}

it('opens the circuit for a stalled provider-owned campaign but not a local outbox message', () => {
  const now = Date.parse('2026-11-04T05:10:00.000Z');
  assert.equal(isWalabzQueueBlocked([log({ campaignId: 'stalled', providerStatus: 'preparing' })], now), true);
  assert.equal(isWalabzQueueBlocked([log({ status: 'Pending', outboxPayload: { campaignName: 'safe', templateId: 't', variableMappings: {} } })], now), false);
});

it('allows the queue to recover after provider campaigns become terminal', () => {
  const now = Date.parse('2026-11-04T05:10:00.000Z');
  assert.equal(isWalabzQueueBlocked([log({ campaignId: 'done', status: 'Delivered', providerStatus: 'completed' })], now), false);
});

it('rejects an unexpected Meta template category', () => {
  assert.throws(() => assertExpectedTemplateCategory('marketing', 'utility', 'order_ofd_label_v1'), /expected utility/i);
  assert.doesNotThrow(() => assertExpectedTemplateCategory('authentication', 'authentication', 'login'));
});

it('backs off outbox retries with a bounded delay', () => {
  const now = Date.parse('2026-11-04T05:00:00.000Z');
  assert.equal(getOutboxRetryAt(1, now), '2026-11-04T05:01:00.000Z');
  assert.equal(getOutboxRetryAt(20, now), '2026-11-04T05:30:00.000Z');
});
