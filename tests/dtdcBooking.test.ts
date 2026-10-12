import { it } from 'node:test';
import assert from 'node:assert/strict';
import { dtdcCustomerReference } from '../src/lib/dtdcBooking';
import { bookCourierShipment } from '../src/lib/courierHelper';
import { db } from '../src/lib/db';
import type { Order, SystemSettings } from '../src/lib/types';

const order = {
  id: 'ord-1159', orderId: '99S-1159', createdAt: '2026-10-12T09:47:02.800Z',
  customerName: 'Test', phonePrimary: '0000000000', address: 'Test',
  pincode: '282006', area: 'Agra', state: 'Uttar Pradesh',
  orderValue: 100, paymentType: 'COD', partiallyPaidAmount: 20, weight: 0.2,
} as Order;
const settings = {
  dtdcActive: true, dtdcConfig: { apiKey: 'production-credential', customerCode: 'CUSTOMER', pincode: '282007' },
  xpressbeesConfig: {},
} as SystemSettings;

it('DTDC references distinguish recycled IDs and stay stable across retries and edits', () => {
  const reference = dtdcCustomerReference(order);
  assert.match(reference, /^OMS-[A-F0-9]{24}$/);
  assert.notEqual(reference, order.orderId);
  assert.equal(reference, dtdcCustomerReference({ ...order, address: 'Changed' } as Order));
  assert.equal(reference, dtdcCustomerReference({ ...order }));
  assert.notEqual(reference, dtdcCustomerReference({ ...order, createdAt: '2026-08-10T09:47:02.800Z' }));
  assert.throws(() => dtdcCustomerReference({ ...order, createdAt: '' }));
});

it('DTDC sends the unique reference without changing shipping/COD fields and validates responses', async (t) => {
  t.mock.method(db, 'addCourierLog', async () => undefined);
  let response: object;
  const references: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://pxapi.dtdc.in/api/customer/integration/consignment/softdata');
    const item = JSON.parse(String(init.body)).consignments[0];
    references.push(item.customer_reference_number);
    assert.equal(item.customer_reference_number, dtdcCustomerReference(order));
    assert.equal(item.reference_number, '');
    assert.equal(item.origin_details.pincode, '282007');
    assert.equal(item.destination_details.pincode, '282006');
    assert.equal(item.cod_amount, '80');
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const book = () => bookCourierShipment(order, settings, order.weight, 'DTDC');
  response = { status: 'OK', data: [{ success: true, reference_number: 'NEWAWB', customer_reference_number: dtdcCustomerReference(order) }] };
  assert.equal((await book()).awb, 'NEWAWB');
  assert.equal((await book()).awb, 'NEWAWB');
  assert.equal(references[0], references[1]);
  response = { status: 'OK', data: [{ success: false, reference_number: 'OLDAWB' }] };
  assert.equal((await book()).success, false);
  response = { status: 'OK', data: [{ success: true, reference_number: 'OLDAWB', customer_reference_number: order.orderId }] };
  const mismatch = await book();
  assert.equal(mismatch.success, false);
  assert.equal(mismatch.reconciliationRequired, true);
  assert.equal(mismatch.awb, undefined);
  response = { status: 'OK', data: [{ success: true }] };
  assert.equal((await book()).reconciliationRequired, true);
});
