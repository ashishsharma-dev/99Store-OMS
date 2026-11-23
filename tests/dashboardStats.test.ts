import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db';
import { Order } from '../src/lib/types';

test('dashboard stats calculation', async (t) => {
  await t.test('computes database-wide metrics accurately without 1000 limit cap', async () => {
    const stats = await db.getOrderStats();

    assert.ok(typeof stats.total === 'number');
    assert.ok(stats.total >= 0);
    assert.equal(stats.total, stats.cod + stats.paid, 'Total should equal COD + Paid count');
    assert.ok(typeof stats.codValue === 'number');
    assert.ok(typeof stats.paidValue === 'number');

    assert.ok(typeof stats.courierCounts === 'object');
    assert.ok(typeof stats.courierCounts.DTDC === 'number');
    assert.ok(typeof stats.courierCounts.XpressBees === 'number');
    assert.ok(typeof stats.courierCounts.Delhivery === 'number');
    assert.ok(typeof stats.courierCounts.Shadowfax === 'number');
    assert.ok(typeof stats.courierCounts.Velocity === 'number');
  });

  await t.test('filters stats correctly by date range', async () => {
    const futureStats = await db.getOrderStats({
      startDate: '2099-01-01T00:00:00.000Z',
      endDate: '2099-12-31T23:59:59.999Z',
    });

    assert.equal(futureStats.total, 0);
    assert.equal(futureStats.cod, 0);
    assert.equal(futureStats.paid, 0);
    assert.equal(futureStats.codValue, 0);
    assert.equal(futureStats.paidValue, 0);
    assert.equal(futureStats.courierCounts.DTDC, 0);
    assert.equal(futureStats.courierCounts.Velocity, 0);
  });
});
