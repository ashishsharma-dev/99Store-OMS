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

      const result = await bookShadowfaxOrder(order, settings, order.weight, '9123456789');
      assert.equal(result.success, true);
      assert.equal(
        (requestPayload?.customer_details as { contact?: string } | undefined)?.contact,
        '9123456789',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

