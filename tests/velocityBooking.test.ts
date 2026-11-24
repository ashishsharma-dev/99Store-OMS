import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatVelocityOrderDate,
  bookVelocityOrder,
  getVelocityBaseUrl,
  checkVelocityServiceability,
} from '../src/lib/velocity';
import { Order, SystemSettings } from '../src/lib/types';
import { mockSettings } from '../src/lib/mockData';

test('velocity courier integration', async (t) => {
  const baseOrder: Order = {
    id: 'test-vel-order-1',
    orderId: '99S-VEL-101',
    customerName: 'Aniket Sharma',
    phonePrimary: '9870740681',
    phoneSecondary: '9999999999', // Dummy phone number
    address: 'Plot 42, Cyber Hub, DLF Phase 2',
    pincode: '122002',
    state: 'Haryana',
    area: 'Gurugram',
    productDetails: '99Store Herbal Tea Pack of 3',
    paymentType: 'COD',
    orderValue: 1299,
    weight: 0.75,
    isVip: false,
    status: 'Packing',
    createdBy: 'admin',
    createdAt: '2026-11-20T10:30:00.000Z',
    updatedAt: '2026-11-20T10:30:00.000Z',
    history: [],
  };

  await t.test('formats velocity order date to YYYY-MM-DD HH:mm', () => {
    const formatted = formatVelocityOrderDate('2026-11-20T10:30:00.000Z');
    assert.match(formatted, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.equal(formatted.startsWith('2026-11-20'), true);
  });

  await t.test('resolves velocity base URL correctly', () => {
    assert.equal(getVelocityBaseUrl(), 'https://shazam.velocity.in');
    assert.equal(
      getVelocityBaseUrl({ apiKey: '', priority: 5, baseUrl: 'https://shazam.stagingvelocity.in/' }),
      'https://shazam.stagingvelocity.in'
    );
  });

  await t.test('books simulated velocity order when simulation is enabled', async () => {
    const prevSim = process.env.ALLOW_COURIER_SIMULATION;
    process.env.ALLOW_COURIER_SIMULATION = 'true';
    try {
      const res = await bookVelocityOrder(baseOrder, mockSettings);
      assert.equal(res.success, true);
      assert.ok(res.awb?.startsWith('VEL'));
      assert.equal(res.courier, 'Velocity');
      assert.ok(res.charge && res.charge > 0);
      assert.ok(res.eta);
    } finally {
      process.env.ALLOW_COURIER_SIMULATION = prevSim;
    }
  });

  await t.test('uses chosen phone override and skips dummy phone numbers for Velocity booking', async () => {
    const prevSim = process.env.ALLOW_COURIER_SIMULATION;
    process.env.ALLOW_COURIER_SIMULATION = 'true';
    try {
      // Order with dummy primary phone
      const orderWithDummyPrimary: Order = {
        ...baseOrder,
        phonePrimary: '9999999999', // Dummy phone
        phoneSecondary: '8057023592', // Real customer phone
      };

      const res = await bookVelocityOrder(orderWithDummyPrimary, mockSettings);
      assert.equal(res.success, true);
      // The shipmentPhone in requestPayload must be the clean real customer phone, never 9999999999
      assert.equal(res.requestPayload?.shipmentPhone, '8057023592');

      // Test explicit phone override
      const resOverride = await bookVelocityOrder(orderWithDummyPrimary, mockSettings, undefined, '7017123456');
      assert.equal(resOverride.success, true);
      assert.equal(resOverride.requestPayload?.shipmentPhone, '7017123456');
    } finally {
      process.env.ALLOW_COURIER_SIMULATION = prevSim;
    }
  });

  await t.test('rejects booking when simulation disabled and credentials missing', async () => {
    const prevSim = process.env.ALLOW_COURIER_SIMULATION;
    delete process.env.ALLOW_COURIER_SIMULATION;
    try {
      const settingsWithoutCreds: SystemSettings = {
        ...mockSettings,
        velocityConfig: {
          apiKey: '',
          username: '',
          password: '',
          priority: 5,
        },
      };

      const res = await bookVelocityOrder(baseOrder, settingsWithoutCreds);
      assert.equal(res.success, false);
      assert.match(res.error || '', /credentials are missing|simulation is disabled/i);
    } finally {
      process.env.ALLOW_COURIER_SIMULATION = prevSim;
    }
  });

  await t.test('serviceability check returns null with message when credentials unconfigured', async () => {
    const res = await checkVelocityServiceability('110001', { apiKey: '', username: '', password: '', priority: 5 });
    assert.equal(res.serviceable, null);
    assert.match(res.message || '', /credentials are not configured/i);
  });

  await t.test('serviceability rejects invalid destination pincodes', async () => {
    const resEmpty = await checkVelocityServiceability('', { apiKey: 'dummy', priority: 5 });
    assert.equal(resEmpty.serviceable, false);

    const resShort = await checkVelocityServiceability('12345', { apiKey: 'dummy', priority: 5 });
    assert.equal(resShort.serviceable, false);

    const resAlpha = await checkVelocityServiceability('ABCDEF', { apiKey: 'dummy', priority: 5 });
    assert.equal(resAlpha.serviceable, false);
  });
});
