import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countOfdAttempts } from '../src/lib/ofdAttempts';

const row = (status: any, timestamp: string) => ({
  status,
  timestamp,
  updatedBy: 'test',
  remarks: 'test',
});

describe('countOfdAttempts', () => {
  it('does not count note-only OFD history rows as new attempts', () => {
    assert.equal(countOfdAttempts([
      row('Dispatched', '2026-11-01T08:00:00.000Z'),
      row('OFD', '2026-11-01T09:00:00.000Z'),
      row('OFD', '2026-11-01T09:10:00.000Z'),
      row('OFD', '2026-11-01T09:20:00.000Z'),
    ]), 1);
  });

  it('counts a later transition back into OFD as a second attempt', () => {
    assert.equal(countOfdAttempts([
      row('OFD', '2026-11-01T09:00:00.000Z'),
      row('NDR', '2026-11-01T17:00:00.000Z'),
      row('Dispatched', '2026-11-02T08:00:00.000Z'),
      row('OFD', '2026-11-02T09:00:00.000Z'),
    ]), 2);
  });
});
