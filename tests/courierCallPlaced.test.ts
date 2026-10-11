import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapCourierStatusToInternal } from '../src/lib/courierSync';
import { getLatestDelhiveryScan } from '../src/lib/delhiveryTracking';

describe('courier call placed tracking', () => {
  it('maps the live Delhivery call instruction to the internal notification status', () => {
    assert.equal(
      mapCourierStatusToInternal('Call placed to consignee'),
      'Call Placed Notification',
    );
  });

  it('selects the newest Delhivery scan from an oldest-first response', () => {
    const latest = getLatestDelhiveryScan([
      {
        ScanDetail: {
          Scan: 'Manifested',
          Instructions: 'Manifest uploaded',
          StatusDateTime: '2026-08-10T10:00:00.000',
        },
      },
      {
        ScanDetail: {
          Scan: 'Dispatched',
          Instructions: 'Call placed to consignee',
          StatusCode: 'ST-114',
          StatusDateTime: '2026-08-11T10:00:00.000',
        },
      },
    ]);

    assert.equal(latest?.Instructions, 'Call placed to consignee');
    assert.equal(latest?.StatusCode, 'ST-114');
  });
});
