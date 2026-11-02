import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  createPackingSlipMediaUrl,
  normalizePublicAppUrl,
  verifyPackingSlipMediaToken,
} from '../src/lib/packingSlipMedia';

const originalAuthSecret = process.env.AUTH_SESSION_SECRET;
const originalMediaSecret = process.env.PACKING_SLIP_MEDIA_SECRET;

afterEach(() => {
  if (originalAuthSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = originalAuthSecret;
  if (originalMediaSecret === undefined) delete process.env.PACKING_SLIP_MEDIA_SECRET;
  else process.env.PACKING_SLIP_MEDIA_SECRET = originalMediaSecret;
});

test('rejects localhost, private IPs, and insecure media origins', () => {
  assert.equal(normalizePublicAppUrl('https://localhost:3000'), null);
  assert.equal(normalizePublicAppUrl('https://192.168.1.10'), null);
  assert.equal(normalizePublicAppUrl('http://oms.ayurvedacare.store'), null);
  assert.equal(normalizePublicAppUrl('https://oms.ayurvedacare.store/path'), 'https://oms.ayurvedacare.store');
});

test('creates an expiring signed public media URL', () => {
  process.env.PACKING_SLIP_MEDIA_SECRET = 'test-media-secret-that-is-at-least-32-characters';
  const now = Date.parse('2026-11-02T09:00:00.000Z');
  const mediaUrl = createPackingSlipMediaUrl('99S-1208', 'https://localhost:3000', now, 60_000);
  const parsed = new URL(mediaUrl);

  assert.equal(parsed.origin, 'https://oms.ayurvedacare.store');
  assert.equal(parsed.pathname, '/api/media/packing-slip/99S-1208');
  assert.equal(
    verifyPackingSlipMediaToken('99S-1208', parsed.searchParams.get('expires'), parsed.searchParams.get('token'), now),
    true,
  );
  assert.equal(
    verifyPackingSlipMediaToken('99S-1208', parsed.searchParams.get('expires'), parsed.searchParams.get('token'), now + 60_001),
    false,
  );
  assert.equal(
    verifyPackingSlipMediaToken('99S-9999', parsed.searchParams.get('expires'), parsed.searchParams.get('token'), now),
    false,
  );
});
