import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Order, WhatsAppLog } from '../src/lib/types';
import { normalizeCustomerWhatsAppNumber } from '../src/lib/customerPhone';
import {
  findOrderForBarcode,
  hasSuccessfulDispatchNotification,
  validateOrderForDispatchScan,
} from '../src/lib/dispatchScan';

const order: Order = {
  id: 'ord-scan',
  orderId: '99S-SCAN',
  customerName: 'Scan Customer',
  phonePrimary: '9000000001',
  phoneWhatsApp: '9876543210',
  address: 'Test address',
  pincode: '282001',
  state: 'UP',
  area: 'Agra',
  productDetails: 'Test product',
  paymentType: 'COD',
  orderValue: 500,
  weight: 0.2,
  createdBy: 'test',
  isVip: false,
  status: 'Label Generated',
  awb: 'AWB-SCAN-1',
  courier: 'DTDC',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  history: [],
};

describe('barcode dispatch workflow', () => {
  it('normalizes and validates the dedicated customer WhatsApp number', () => {
    assert.equal(normalizeCustomerWhatsAppNumber('+91 98765 43210'), '9876543210');
    assert.equal(normalizeCustomerWhatsAppNumber('12345'), null);
  });

  it('finds an order by order barcode or AWB', () => {
    assert.equal(findOrderForBarcode([order], '99s-scan')?.id, order.id);
    assert.equal(findOrderForBarcode([order], 'awb-scan-1')?.id, order.id);
  });

  it('requires an AWB, ready status, and customer WhatsApp number', () => {
    assert.equal(validateOrderForDispatchScan(order), null);
    assert.match(validateOrderForDispatchScan({ ...order, awb: undefined })!, /AWB/);
    assert.match(validateOrderForDispatchScan({ ...order, phoneWhatsApp: undefined })!, /WhatsApp/);
    assert.match(validateOrderForDispatchScan({ ...order, status: 'Created' })!, /Label Generated/);
  });

  it('recognizes a successful dispatch notification only for the customer WhatsApp number', () => {
    const log: WhatsAppLog = {
      id: 'wa-scan',
      timestamp: new Date().toISOString(),
      phone: '919876543210',
      type: 'Primary',
      message: 'Dispatched',
      status: 'Sent',
      orderId: order.orderId,
      templateName: 'Dispatched',
    };
    assert.equal(hasSuccessfulDispatchNotification([log], order), true);
    assert.equal(hasSuccessfulDispatchNotification([{ ...log, phone: '919999999999' }], order), false);
  });
});
