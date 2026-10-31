import assert from 'node:assert/strict';
import { afterEach, it, mock } from 'node:test';
import { db } from '../src/lib/db';
import { mockSettings } from '../src/lib/mockData';
import type { WhatsAppLog } from '../src/lib/types';
import { WalabzClient } from '../src/lib/walabz';
import { reconcileWhatsAppLogs } from '../src/lib/whatsappReconciliation';

afterEach(() => mock.restoreAll());

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
    return campaignId === 'failed-campaign'
      ? [{ status: 'failed', error_message: 'Known non-WhatsApp number' }]
      : [];
  });

  const result = await reconcileWhatsAppLogs();

  assert.deepEqual(result, { checked: 3, updated: 3, failed: 0 });
  assert.equal(saved.find(log => log.id === 'wa-delivered')?.status, 'Delivered');
  assert.equal(saved.find(log => log.id === 'wa-failed')?.status, 'Failed');
  assert.equal(saved.find(log => log.id === 'wa-failed')?.errorDetail, 'Known non-WhatsApp number');
  assert.equal(saved.find(log => log.id === 'wa-no-campaign')?.status, 'Failed');
  assert.match(saved.find(log => log.id === 'wa-no-campaign')?.errorDetail || '', /no Walabz campaign ID/i);
  assert.ok(saved.every(log => Boolean(log.lastProviderSyncAt)));
});
