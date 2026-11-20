import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bookShadowfaxOrder } from '../src/lib/shadowfax';
import type { Order, SystemSettings } from '../src/lib/types';

const order: Order = {
  id: 'ord-contact-test',
  orderId: '99S-CONTACT-TEST',
  customerName: 'Contact Test',
  phonePrimary: '9000000001',
  phoneSecondary: '9000000002',
  phoneTertiary: '9000000003',
  phoneWhatsApp: '9000000004',
  address: 'Test address',
  pincode: '282001',
  state: 'Uttar Pradesh',
  area: 'Agra',
  productDetails: 'Test product',
  paymentType: 'COD',
  orderValue: 500,
  weight: 0.2,
  createdBy: 'test',
  isVip: false,
  status: 'Packing',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  history: [],
};

describe('courier shipment contact payloads', () => {
  it('places the selected contact in the Shadowfax customer payload', async () => {
    const originalFetch = globalThis.fetch;
    let requestPayload: Record<string, unknown> | undefined;

    globalThis.fetch = async (_input, init) => {
      requestPayload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        message: 'Success',
        data: { awb_number: 'SF-CONTACT-TEST' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const settings = {
        shadowfaxConfig: {
          apiKey: 'live-token-abc123',
          priority: 1,
          baseUrl: 'https://shadowfax.invalid/api',
          pincode: '282001',
        },
      } as SystemSettings;

      const result = await bookShadowfaxOrder(order, settings, order.weight, '9870001122');
      assert.equal(result.success, true);
      assert.equal(
        (requestPayload?.customer_details as { contact?: string } | undefined)?.contact,
        '9870001122',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('bypasses dummy phone numbers and uses the customer phone instead', async () => {
    const originalFetch = globalThis.fetch;
    let requestPayload: Record<string, unknown> | undefined;

    globalThis.fetch = async (_input, init) => {
      requestPayload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        message: 'Success',
        data: { awb_number: 'SF-CONTACT-TEST-2' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const settings = {
        shadowfaxConfig: {
          apiKey: 'live-token-abc123',
          priority: 1,
          baseUrl: 'https://shadowfax.invalid/api',
          pincode: '282001',
        },
      } as SystemSettings;

      // Passing a known dummy phone number (e.g. 9876543210) should be ignored
      const result = await bookShadowfaxOrder(order, settings, order.weight, '9876543210');
      assert.equal(result.success, true);
      // Fallback resolves to customer phoneTertiary: 9000000003
      assert.equal(
        (requestPayload?.customer_details as { contact?: string } | undefined)?.contact,
        '9000000003',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

