import assert from 'node:assert/strict';
import { afterEach, it, mock } from 'node:test';
import { GET, loadNotificationSnapshot } from '../src/app/api/notifications/stream/route';
import { db } from '../src/lib/db';
import type { NdrRecord, Order } from '../src/lib/types';

afterEach(() => mock.restoreAll());

it('loads recently updated orders in descending order for the live feed', async () => {
  const order = { id: 'order-1', orderId: '99S-1', updatedAt: '2026-11-02T05:00:00Z' } as Order;
  const olderNdr = { id: 'ndr-old', createdAt: '2026-11-01T05:00:00Z' } as NdrRecord;
  const newerNdr = { id: 'ndr-new', createdAt: '2026-11-02T05:00:00Z' } as NdrRecord;
  const queryOrders = mock.method(db, 'queryOrders', async () => ({
    items: [order], totalCount: 1, totalPages: 1, currentPage: 1, limit: 50,
  }));
  mock.method(db, 'getNdrRecords', async () => [olderNdr, newerNdr]);

  const snapshot = await loadNotificationSnapshot();

  assert.deepEqual(queryOrders.mock.calls[0].arguments[0], {
    page: 1, limit: 50, sortField: 'updatedAt', sortOrder: 'desc',
  });
  assert.equal(snapshot.orders[0].id, 'order-1');
  assert.deepEqual(snapshot.ndrRecords.map(record => record.id), ['ndr-new', 'ndr-old']);
});

it('disables proxy buffering and immediately emits an SSE connection event', async () => {
  mock.method(db, 'queryOrders', async () => ({
    items: [], totalCount: 0, totalPages: 0, currentPage: 1, limit: 50,
  }));
  mock.method(db, 'getNdrRecords', async () => []);
  const abortController = new AbortController();
  const response = await GET(new Request('http://localhost/api/notifications/stream', {
    signal: abortController.signal,
  }));

  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-transform');
  assert.equal(response.headers.get('x-accel-buffering'), 'no');

  const reader = response.body!.getReader();
  const firstChunk = await reader.read();
  const text = new TextDecoder().decode(firstChunk.value);
  assert.match(text, /^data: /);
  assert.match(text, /System Telemetry Connected/);

  abortController.abort();
  await reader.cancel();
});
