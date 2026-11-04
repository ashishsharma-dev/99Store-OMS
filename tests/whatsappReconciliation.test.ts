import assert from 'node:assert/strict';
import { afterEach, it, mock } from 'node:test';
import { db, selectWhatsAppReconciliationBatch } from '../src/lib/db';
import { mockSettings } from '../src/lib/mockData';
import type { WhatsAppLog } from '../src/lib/types';
import { WalabzClient } from '../src/lib/walabz';
import { reconcileWhatsAppLogs } from '../src/lib/whatsappReconciliation';
import { getWalabzQueueTimeoutReason } from '../src/lib/whatsappDelivery';

afterEach(() => mock.restoreAll());

it('prioritizes login OTPs while sampling both ends of a blocked queue', () => {
  const candidates = [
    { id: 'old', timestamp: '2026-11-01T00:00:00Z', templateName: 'NDR' },
    { id: 'middle', timestamp: '2026-11-02T00:00:00Z', templateName: 'OFD' },
    { id: 'new', timestamp: '2026-11-03T00:00:00Z', templateName: 'Dispatched' },
    { id: 'otp', timestamp: '2026-11-02T12:00:00Z', templateName: 'login_otp' },
  ].map(log => ({
    ...log, phone: '919000000001', type: 'Primary', message: 'test', status: 'Queued',
  })) as WhatsAppLog[];

  assert.deepEqual(
    selectWhatsAppReconciliationBatch(candidates, 3).map(log => log.id),
    ['otp', 'new', 'old'],
  );
});

it('times out zero-recipient provider queues without treating active processing as failed', () => {
  const otpLog = { timestamp: new Date(10_000).toISOString(), templateName: 'login_otp' };
  const messageLog = { timestamp: new Date(10_000).toISOString(), templateName: 'OFD' };
  const preparing = { status: 'preparing', total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };

  assert.match(getWalabzQueueTimeoutReason(otpLog, preparing, 55_001) || '', /45 seconds/i);
  assert.equal(getWalabzQueueTimeoutReason(messageLog, preparing, 55_001), undefined);
  assert.equal(getWalabzQueueTimeoutReason(otpLog, { ...preparing, total: 1 }, 55_001), undefined);
});

it('reconciles queued campaigns and stores message-level provider failure reasons', async () => {
  const logs = [
    {
      id: 'wa-delivered', timestamp: '2026-10-31T18:14:01.989Z', phone: '919000000001',
      type: 'Primary', message: 'test', status: 'Queued', campaignId: 'delivered-campaign',
    },
    {
      id: 'wa-failed', timestamp: '2026-10-31T18:14:15.119Z', phone: '919000000002',
      type: 'Primary', message: 'test', status: 'Queued', campaignId: 'failed-campaign',
    },
    {
      id: 'wa-no-campaign', timestamp: '2026-08-10T10:35:17.136Z', phone: '919000000003',
      type: 'Primary', message: 'test', status: 'Pending',
    },
    {
      id: 'wa-existing-failure', timestamp: '2026-10-30T18:57:58.726Z', phone: '919000000004',
      type: 'Primary', message: 'test', status: 'Failed', campaignId: 'existing-failed-campaign',
      errorDetail: 'Walabz failed to send the campaign. Check the provider delivery report.',
    },
    {
      id: 'wa-late-media-failure', timestamp: '2026-11-02T07:13:26.016Z', phone: '919000000005',
      type: 'Primary', message: 'test', status: 'Sent', campaignId: 'late-media-failure-campaign',
      imageUrl: 'https://localhost:3000/packing-slips/99S-1208.png',
    },
  ] as WhatsAppLog[];
  const saved: WhatsAppLog[] = [];

  mock.method(db, 'getWhatsAppLogsForReconciliation', async () => logs.map(log => ({ ...log })));
  mock.method(db, 'saveWhatsAppLog', async (log: WhatsAppLog) => { saved.push({ ...log }); });
  mock.method(db, 'getSettings', async () => mockSettings);
  mock.method(WalabzClient.prototype, 'getCampaignProgress', async function (campaignId: string) {
    return campaignId === 'delivered-campaign'
      ? { status: 'completed', sent: 1, delivered: 1, failed: 0 }
      : { status: 'completed', sent: 0, delivered: 0, failed: 1 };
  });
  mock.method(WalabzClient.prototype, 'getCampaignMessages', async function (campaignId: string) {
    return ['failed-campaign', 'existing-failed-campaign', 'late-media-failure-campaign'].includes(campaignId)
      ? [{ status: 'failed', error_message: campaignId === 'late-media-failure-campaign' ? 'Media upload error: HTTP 403' : 'Known non-WhatsApp number' }]
      : [];
  });

  const result = await reconcileWhatsAppLogs();

  assert.deepEqual(result, { checked: 5, updated: 5, failed: 0 });
  assert.equal(saved.find(log => log.id === 'wa-delivered')?.status, 'Delivered');
  assert.equal(saved.find(log => log.id === 'wa-failed')?.status, 'Failed');
  assert.equal(saved.find(log => log.id === 'wa-failed')?.errorDetail, 'Known non-WhatsApp number');
  assert.equal(saved.find(log => log.id === 'wa-no-campaign')?.status, 'Failed');
  assert.match(saved.find(log => log.id === 'wa-no-campaign')?.errorDetail || '', /no Walabz campaign ID/i);
  assert.equal(saved.find(log => log.id === 'wa-existing-failure')?.errorDetail, 'Known non-WhatsApp number');
  assert.equal(saved.find(log => log.id === 'wa-late-media-failure')?.status, 'Failed');
  assert.equal(saved.find(log => log.id === 'wa-late-media-failure')?.errorDetail, 'Media upload error: HTTP 403');
  assert.ok(saved.every(log => Boolean(log.lastProviderSyncAt)));
});

it('removes stale preparing campaigns from the reconciliation queue', async () => {
  const logs = [
    {
      id: 'wa-stale-otp', timestamp: new Date(Date.now() - 60_000).toISOString(), phone: '919000000001',
      type: 'Primary', message: 'test', templateName: 'login_otp', status: 'Queued', campaignId: 'stale-otp',
    },
    {
      id: 'wa-stale-message', timestamp: new Date(Date.now() - 31 * 60_000).toISOString(), phone: '919000000002',
      type: 'Primary', message: 'test', templateName: 'OFD', status: 'Queued', campaignId: 'stale-message',
    },
  ] as WhatsAppLog[];
  const saved: WhatsAppLog[] = [];

  mock.method(db, 'getWhatsAppLogsForReconciliation', async () => logs.map(log => ({ ...log })));
  mock.method(db, 'saveWhatsAppLog', async (log: WhatsAppLog) => { saved.push({ ...log }); });
  mock.method(db, 'getSettings', async () => mockSettings);
  mock.method(WalabzClient.prototype, 'getCampaignProgress', async function () {
    return { status: 'preparing', total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  });

  const result = await reconcileWhatsAppLogs();

  assert.deepEqual(result, { checked: 2, updated: 2, failed: 0 });
  assert.ok(saved.every(log => log.status === 'Failed'));
  assert.ok(saved.every(log => /zero recipients/i.test(log.errorDetail || '')));
});
