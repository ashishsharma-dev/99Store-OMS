import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { bookCourierShipment } from '../src/lib/courierHelper';
import {
  isCourierSimulationEnabled,
  isUncertainBookingFailure,
  validateManifestWaybills,
} from '../src/lib/courierReliability';
import type { Order, SystemSettings } from '../src/lib/types';

const originalFetch = globalThis.fetch;
const originalSimulationFlag = process.env.ALLOW_COURIER_SIMULATION;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSimulationFlag === undefined) delete process.env.ALLOW_COURIER_SIMULATION;
  else process.env.ALLOW_COURIER_SIMULATION = originalSimulationFlag;
});

const baseOrder: Order = {
  id: 'reliability-test-order',
  orderId: '99S-RELIABILITY-TEST',
  customerName: 'Reliability Test',
  phonePrimary: '9876543210',
  address: 'Test address',
  pincode: '282001',
  state: 'Uttar Pradesh',
  area: 'Agra',
  productDetails: 'Test product',
  paymentType: 'COD',
  orderValue: 999,
  weight: 0.5,
  createdBy: 'test',
  isVip: false,
  status: 'Packing',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  history: [],
};

function settings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    dtdcActive: false,
    xpressbeesActive: false,
    deliveryActive: false,
    shadowfaxActive: false,
    dtdcConfig: {} as SystemSettings['dtdcConfig'],
    xpressbeesConfig: {} as SystemSettings['xpressbeesConfig'],
    deliveryConfig: {} as SystemSettings['deliveryConfig'],
    ...overrides,
  } as SystemSettings;
}

describe('courier reliability safeguards', () => {
  it('rejects placeholder credentials when simulation was not explicitly enabled', async () => {
    delete process.env.ALLOW_COURIER_SIMULATION;
    assert.equal(isCourierSimulationEnabled(), false);

    const result = await bookCourierShipment(
      baseOrder,
      settings({
        dtdcActive: true,
        dtdcConfig: { apiKey: 'MOCK_KEY' } as SystemSettings['dtdcConfig'],
      }),
      baseOrder.weight,
      'DTDC',
      baseOrder.phonePrimary,
    );

    assert.equal(result.success, false);
    assert.match(result.error || '', /simulation is disabled/i);
    assert.equal(result.awb, undefined);
  });

  it('does not convert a failed live XpressBees booking into a random AWB', async () => {
    delete process.env.ALLOW_COURIER_SIMULATION;
    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Response(JSON.stringify({ token: 'real-token' }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: false, message: 'Provider rejected shipment' }), { status: 422 });
    };

    const result = await bookCourierShipment(
      baseOrder,
      settings({
        xpressbeesActive: true,
        xpressbeesConfig: {
          authType: 'old',
          email: 'merchant@example.org',
          password: 'real-looking-password',
          baseUrl: 'https://shipment.example.org/api',
        } as SystemSettings['xpressbeesConfig'],
      }),
      baseOrder.weight,
      'XpressBees',
      baseOrder.phonePrimary,
    );

    assert.equal(result.success, false);
    assert.match(result.error || '', /provider rejected shipment/i);
    assert.equal(result.awb, undefined);
  });

  it('validates that every manifest AWB belongs to the intended courier', () => {
    const orders: Order[] = [
      { ...baseOrder, id: 'xb-order', awb: 'XB-100', courier: 'XpressBees' },
      { ...baseOrder, id: 'dtdc-order', orderId: '99S-DTDC', awb: 'DTDC-200', courier: 'DTDC' },
    ];

    assert.deepEqual(validateManifestWaybills([' XB-100 ', 'XB-100'], orders), {
      valid: true,
      waybills: ['XB-100'],
    });

    const wrongCourier = validateManifestWaybills(['DTDC-200'], orders);
    assert.equal(wrongCourier.valid, false);
    assert.match(wrongCourier.error, /not booked with XpressBees/i);

    const unknown = validateManifestWaybills(['XB-UNKNOWN'], orders);
    assert.equal(unknown.valid, false);
    assert.match(unknown.error, /not assigned to an order/i);
  });

  it('marks network ambiguity for reconciliation instead of blind retry', () => {
    assert.equal(isUncertainBookingFailure('DTDC booking network error: fetch failed'), true);
    assert.equal(isUncertainBookingFailure('Provider rejected invalid pincode'), false);
  });
});
