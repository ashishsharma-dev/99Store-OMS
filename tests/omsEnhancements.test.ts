import assert from 'node:assert/strict';
import { afterEach, before, after, describe, it, mock } from 'node:test';
import { db, filterOrdersInMemory, isOrderBooked, isOrderPartiallyPaid, isOrderPaymentSettled } from '../src/lib/db';
import { GET as getReports } from '../src/app/api/reports/route';
import { GET as getSettingsRoute } from '../src/app/api/settings/route';
import { GET as getUsersRoute } from '../src/app/api/users/route';
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/lib/session';
import { mockSettings } from '../src/lib/mockData';
import type { Order, User } from '../src/lib/types';

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'ord-1',
    orderId: '99S-1001',
    customerName: 'Test Customer',
    phonePrimary: '9000000001',
    phoneSecondary: '9000000002',
    phoneTertiary: '9876500001',
    phoneWhatsApp: '9876500002',
    address: '123 Test Street',
    pincode: '282001',
    state: 'Uttar Pradesh',
    area: 'Agra',
    productDetails: 'Wellness Pack',
    paymentType: 'COD',
    orderValue: 1000,
    weight: 0.2,
    createdBy: 'order_user',
    isVip: false,
    status: 'Created',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    history: [],
    ...overrides,
  };
}

describe('OMS multi-variation filtering and status helpers', () => {
  const sampleOrders: Order[] = [
    makeOrder({
      id: 'ord-paid',
      orderId: '99S-2001',
      paymentType: 'Paid',
      orderValue: 999,
      courier: 'DTDC',
      status: 'Label Generated',
      labelPrinted: true,
      isBooked: false,
      createdBy: 'order_user',
    }),
    makeOrder({
      id: 'ord-partial',
      orderId: '99S-2002',
      paymentType: 'COD',
      orderValue: 1200,
      partiallyPaidAmount: 300,
      finalPayableAmount: 900,
      courier: 'XpressBees',
      status: 'Dispatched',
      labelPrinted: false,
      isBooked: true,
      isPaymentSettled: false,
      createdBy: 'admin',
    }),
    makeOrder({
      id: 'ord-pure-cod',
      orderId: '99S-2003',
      paymentType: 'COD',
      orderValue: 750,
      partiallyPaidAmount: 0,
      courier: undefined,
      status: 'Delivered',
      labelPrinted: true,
      isPaymentSettled: true,
      phoneWhatsApp: '9988776655',
      createdBy: 'order_user',
    }),
    makeOrder({
      id: 'ord-deleted',
      orderId: '99S-2004',
      isDeleted: true,
    }),
  ];

  it('filters payment variations including Paid, COD, Pure COD, and Partially Paid', () => {
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { payment: 'Paid' }).map(o => o.id), ['ord-paid']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { payment: 'COD' }).map(o => o.id), ['ord-partial', 'ord-pure-cod']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { payment: 'Partially Paid' }).map(o => o.id), ['ord-partial']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { payment: 'Pure COD' }).map(o => o.id), ['ord-pure-cod']);
    assert.equal(isOrderPartiallyPaid(sampleOrders[1]), true);
    assert.equal(isOrderPartiallyPaid(sampleOrders[2]), false);
  });

  it('filters labelPrinted, booked status, unassigned courier, payment settlement, creator, and WhatsApp search', () => {
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { labelPrinted: true }).map(o => o.id), ['ord-paid', 'ord-pure-cod']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { labelPrinted: false }).map(o => o.id), ['ord-partial']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { isBooked: true }).map(o => o.id), ['ord-partial', 'ord-pure-cod']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { isBooked: false }).map(o => o.id), ['ord-paid']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { courier: 'Unassigned' }).map(o => o.id), ['ord-pure-cod']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { paymentSettled: 'settled' }).map(o => o.id), ['ord-paid', 'ord-pure-cod']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { paymentSettled: 'unsettled' }).map(o => o.id), ['ord-partial']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { createdBy: 'ADMIN' }).map(o => o.id), ['ord-partial']);
    assert.deepEqual(filterOrdersInMemory(sampleOrders, { search: '9988776655' }).map(o => o.id), ['ord-pure-cod']);
    assert.equal(isOrderBooked(sampleOrders[0]), false);
    assert.equal(isOrderBooked(sampleOrders[2]), true);
    assert.equal(isOrderPaymentSettled(sampleOrders[2]), true);
  });
});

describe('Reports CSV export and non-admin settings/users access', () => {
  const originalSessionSecret = process.env.AUTH_SESSION_SECRET;

  before(() => {
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-sufficient-entropy';
  });

  after(() => {
    if (originalSessionSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = originalSessionSecret;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('exports customer contact numbers, partial payment, label printed, and booked columns in CSV', async () => {
    mock.method(db, 'getOrders', async () => [
      makeOrder({
        id: 'ord-csv',
        orderId: '99S-3001',
        customerName: 'Ramesh Verma',
        phonePrimary: '8439581832',
        phoneTertiary: '9876543210',
        phoneWhatsApp: '9811122233',
        paymentType: 'COD',
        orderValue: 1500,
        partiallyPaidAmount: 500,
        finalPayableAmount: 1000,
        labelPrinted: true,
        isBooked: true,
        isPaymentSettled: true,
        status: 'Dispatched',
        courier: 'DTDC',
        awb: 'D999888777',
      }),
    ]);

    const res = await getReports(new Request('http://localhost/api/reports?payment=Partially+Paid&labelPrinted=true'));
    assert.equal(res.status, 200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'CSV response bytes should start with UTF-8 BOM for Excel');
    const csv = new TextDecoder('utf-8').decode(bytes);
    assert.match(csv, /Customer Contact Number/);
    assert.match(csv, /Customer WhatsApp Number/);
    assert.match(csv, /\t9876543210/);
    assert.match(csv, /\t9811122233/);
    assert.match(csv, /Partially Paid/);
    assert.match(csv, /Printed/);
    assert.match(csv, /Booked/);
    assert.match(csv, /Yes/);
  });

  it('allows non-admin authenticated users to read contact numbers from settings and public user names without leaking secrets', async () => {
    const orderUser: User = {
      id: 'usr-2',
      username: 'order_user',
      name: 'Rahul K.',
      role: 'Order Team',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      phone: '9999999999',
      password: 'hashed-password',
    };
    mock.method(db, 'getUserByUsername', async () => orderUser);
    mock.method(db, 'getUsers', async () => [orderUser]);
    mock.method(db, 'getSettings', async () => ({
      ...mockSettings,
      primaryContactNumbers: ['+91 8439581832'],
      secondaryContactNumbers: ['+91 8439581833'],
      additionalContactNumbers1: ['+91 8439581834'],
      additionalContactNumbers2: ['+91 8439581835'],
      walabzApiKey: 'secret-api-key',
    }));

    const token = createSessionToken({
      id: orderUser.id,
      username: orderUser.username,
      name: orderUser.name,
      role: orderUser.role,
    });
    const cookieHeader = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;

    const settingsRes = await getSettingsRoute(new Request('http://localhost/api/settings', { headers: { cookie: cookieHeader } }));
    assert.equal(settingsRes.status, 200);
    const settingsJson = await settingsRes.json();
    assert.deepEqual(settingsJson.settings.primaryContactNumbers, ['+91 8439581832']);
    assert.deepEqual(settingsJson.settings.additionalContactNumbers1, ['+91 8439581834']);
    assert.equal(settingsJson.settings.walabzApiKey, undefined);
    assert.equal(settingsJson.settings.dtdcConfig, undefined);

    const usersRes = await getUsersRoute(new Request('http://localhost/api/users', { headers: { cookie: cookieHeader } }));
    assert.equal(usersRes.status, 200);
    const usersJson = await usersRes.json();
    assert.equal(usersJson.users[0].username, 'order_user');
    assert.equal(usersJson.users[0].password, undefined);
    assert.equal(usersJson.users[0].phone, undefined);

    const unauthSettings = await getSettingsRoute(new Request('http://localhost/api/settings'));
    assert.equal(unauthSettings.status, 401);
  });
});
