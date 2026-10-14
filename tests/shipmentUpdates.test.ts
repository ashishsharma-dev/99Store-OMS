import assert from 'node:assert/strict';
import { afterEach, beforeEach, it, mock } from 'node:test';
import { handleCourierTracking } from '../src/lib/courierTrackingHandler';
import { db } from '../src/lib/db';
import { syncOrderStatus } from '../src/lib/courierSync';
import { normalizeCourierEventTime } from '../src/lib/courierEventTime';
import { parseXpressBeesServiceability, checkXpressBeesServiceability } from '../src/lib/xpressbees';
import { checkShadowfaxServiceability } from '../src/lib/shadowfax';
import { triggerWhatsAppNotification } from '../src/lib/whatsapp';
import { mockSettings } from '../src/lib/mockData';
import { WalabzClient, type SendCampaignOptions } from '../src/lib/walabz';
import { summarizeOtpCampaignProgress } from '../src/lib/otpDispatch';
import type { Order, SystemSettings, WhatsAppLog } from '../src/lib/types';

let order: Order;
let logs: WhatsAppLog[];
beforeEach(() => {
  order = { id: 'test', orderId: 'test', awb: 'AWB-TEST', status: 'Dispatched', history: [], phonePrimary: '9000000000', customerName: 'Test', orderValue: 100, paymentType: 'Paid', address: 'Test', pincode: '110001', state: 'Delhi', area: 'Delhi', productDetails: 'Test', weight: 1, createdBy: 'test', isVip: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' } as Order;
  logs = [];
  mock.method(db, 'addCourierLog', async () => {});
  mock.method(db, 'getOrders', async () => [structuredClone(order)]);
  mock.method(db, 'getOrderByOrderId', async () => structuredClone(order));
  mock.method(db, 'saveOrder', async (value: Order) => { order = structuredClone(value); return value; });
  mock.method(db, 'getSettings', async () => ({ ...mockSettings, whatsappNotificationsEnabled: true, walabzTemplates: { Dispatched: 'template' } }) as SystemSettings);
  mock.method(db, 'getWhatsAppLogs', async () => logs);
  mock.method(db, 'addWhatsAppLog', async (log: WhatsAppLog) => { logs.push(log); });
  mock.method(db, 'getNdrRecordByOrderId', async () => null);
  mock.method(db, 'saveNdrRecord', async (record: unknown) => record);
});
afterEach(() => mock.restoreAll());

it('interprets offsetless courier time in India and preserves explicit UTC', () => {
  assert.equal(normalizeCourierEventTime('2026-10-14 10:00:00'), '2026-10-14T04:30:00.000Z');
  assert.equal(normalizeCourierEventTime('2026-10-14T10:00:00Z'), '2026-10-14T10:00:00.000Z');
  assert.equal(normalizeCourierEventTime('bad-date'), undefined);
});
it('serializes duplicate concurrent OFD callbacks and uses event time', async () => {
  await Promise.all([1, 2].map(() => syncOrderStatus('AWB-TEST', 'OFD', '', '', undefined, '2026-10-14T04:30:00Z')));
  assert.equal(order.history.length, 1);
  assert.equal(order.history[0].timestamp, '2026-10-14T04:30:00.000Z');
});
it('does not add OFD history for an ETA-only update', async () => {
  order.status = 'OFD';
  await syncOrderStatus('AWB-TEST', 'OFD', '', '', '2026-10-16');
  assert.equal(order.eta, '2026-10-16');
  assert.equal(order.history.length, 0);
  assert.equal(logs.length, 0);
});
it('ignores older events and never reopens delivered shipments', async () => {
  order.status = 'OFD';
  order.lastCourierEventAt = '2026-10-14T04:30:00Z';
  await syncOrderStatus('AWB-TEST', 'Dispatched', '', '', undefined, '2026-10-13T04:30:00Z');
  assert.equal(order.status, 'OFD');
  order.status = 'Delivered';
  await syncOrderStatus('AWB-TEST', 'OFD');
  assert.equal(order.status, 'Delivered');
});
it('retains a genuine OFD reattempt after NDR', async () => {
  await syncOrderStatus('AWB-TEST', 'OFD', '', '', undefined, '2026-10-13T04:30:00Z');
  await syncOrderStatus('AWB-TEST', 'NDR', '', '', undefined, '2026-10-13T10:30:00Z');
  await syncOrderStatus('AWB-TEST', 'OFD', '', '', undefined, '2026-10-14T04:30:00Z');
  assert.deepEqual(order.history.map(item => item.status), ['OFD', 'NDR', 'OFD']);
});
it('does not equate XpressBees transport success with serviceability', () => {
  assert.equal(parseXpressBeesServiceability({ ReturnCode: 100 }, '600001'), null);
  assert.equal(parseXpressBeesServiceability({ data: [{ Pincode: 600001, Serviceable: 'N' }] }, '600001'), false);
  assert.equal(parseXpressBeesServiceability({ data: [{ Pincode: 600001, Serviceable: 'Y' }] }, '600001'), true);
  assert.equal(parseXpressBeesServiceability({ ReturnCode: 401 }, '600001'), null);
});
it('uses Surface credentials, XBKey and service together', async () => {
  const calls: RequestInit[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    calls.push(init);
    return Response.json(calls.length === 1 ? { token: 'surface-token' } : { data: [{ Pincode: 600001, Serviceable: 'Y' }] });
  });
  assert.equal(await checkXpressBeesServiceability('600001', { activeAccount: 'Air', airAccount: { email: 'air@unit.invalid', password: 'air', xbKey: 'air-key' }, surfaceAccount: { email: 'surface@unit.invalid', password: 'surface', xbKey: 'surface-key' } }, 'XpressBees Surface'), true);
  assert.equal(JSON.parse(String(calls[0].body)).username, 'surface@unit.invalid');
  assert.equal((calls[1].headers as Record<string, string>).XBKey, 'surface-key');
  assert.equal(JSON.parse(String(calls[1].body)).BusinessService, 'Surface');
});
it('reports Shadowfax transport failure as unknown and checks the applicable tier', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  assert.equal((await checkShadowfaxServiceability('800001', { apiKey: 'unit', priority: 1 })).serviceable, null);
  fetchMock.mock.mockImplementation(async () => Response.json([{ code: 800001, services: ['Regular'] }]));
  assert.equal((await checkShadowfaxServiceability('800001', { apiKey: 'unit', priority: 1 })).serviceable, true);
  assert.equal((await checkShadowfaxServiceability('800001', { apiKey: 'unit', priority: 1, serviceTier: 'Surface' })).serviceable, false);
});
it('retries a failed dispatch and sends only to the customer WhatsApp number', async () => {
  order.phoneWhatsApp = '9876543210';
  logs.push({ id: 'failed', orderId: 'test', phone: '919876543210', templateName: 'Dispatched', status: 'Failed', timestamp: new Date().toISOString() } as WhatsAppLog);
  mock.method(WalabzClient.prototype, 'getTemplateById', async () => ({ header_type: 'none' }));
  const send = mock.method(WalabzClient.prototype, 'sendCampaign', async (_options: SendCampaignOptions) => ({ success: true, campaignId: 'test-campaign' }));
  mock.method(WalabzClient.prototype, 'getCampaignProgress', async () => ({ status: 'completed', sent: 1 }));
  const result = await triggerWhatsAppNotification({ orderId: 'test', customerName: 'Test', phonePrimary: '9000000000', status: 'Dispatched', orderValue: 100, paymentType: 'Paid' });
  assert.equal(result[0].status, 'Sent');
  assert.deepEqual(send.mock.calls[0].arguments[0].recipients, ['919876543210']);
});
it('does not mark a completed but failed campaign as sent', () => {
  assert.equal(summarizeOtpCampaignProgress({ status: 'completed', sent: 0, failed: 1 }), 'failed');
});

it('updates ETA for a replayed current event without duplicating its status', async () => {
  await syncOrderStatus('AWB-TEST', 'OFD', '', '', undefined, '2026-10-14T04:30:00Z');
  await syncOrderStatus('AWB-TEST', 'OFD', '', '', '2026-10-16', '2026-10-14T04:30:00Z');
  assert.equal(order.eta, '2026-10-16');
  assert.equal(order.history.length, 1);
});
it('does not treat an OFD reattempt instruction as a failed delivery', async () => {
  await syncOrderStatus('AWB-TEST', 'OFD', '', 'Out for delivery for reattempt');
  assert.equal(order.status, 'OFD');
});
it('does not regress OFD on an undated transit response', async () => {
  order.status = 'OFD';
  await syncOrderStatus('AWB-TEST', 'In Transit');
  assert.equal(order.status, 'OFD');
});
it('does not turn a failed Shadowfax tracking response into a shipment event', async () => {
  mock.method(db, 'getSettings', async () => ({ ...mockSettings, shadowfaxActive: true, shadowfaxConfig: { apiKey: 'unit', priority: 1 } }));
  mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Unavailable' }, { status: 503 }));
  order.status = 'OFD';
  const response = await handleCourierTracking(new Request('http://localhost/api/integrations/courier?action=track&waybill=AWB-TEST&courier=Shadowfax'));
  assert.equal(response.status, 502);
  assert.equal(order.status, 'OFD');
  assert.equal(order.history.length, 0);
});
