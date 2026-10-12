import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DtdcTrackingError,
  extractDtdcTrackingToken,
  trackDtdcShipment,
} from '../src/lib/dtdcTracking';
import { fetchWithRetry } from '../src/lib/fetchWithRetry';

describe('DTDC tracking authentication', () => {
  it('extracts tokens from headers, JSON, and plain-text responses', () => {
    assert.equal(
      extractDtdcTrackingToken('', new Headers({ 'X-Access-Token': 'header-token' })),
      'header-token',
    );
    assert.equal(extractDtdcTrackingToken('{"data":{"accessToken":"json-token"}}'), 'json-token');
    assert.equal(extractDtdcTrackingToken('{"data":"nested-plain-token"}'), 'nested-plain-token');
    assert.equal(extractDtdcTrackingToken('plain-token'), 'plain-token');
    assert.equal(extractDtdcTrackingToken('{"error":"invalid credentials"}'), '');
  });

  it('refreshes an expired configured token after a 401 and retries tracking once', async () => {
    const calls: Array<{ url: string; token?: string }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = input.toString();
      const headers = new Headers(init?.headers);
      calls.push({ url, token: headers.get('X-Access-Token') || undefined });

      if (url.includes('/authenticate')) {
        return new Response('{"token":"fresh-token"}', { status: 200 });
      }
      if (headers.get('X-Access-Token') === 'expired-token') {
        return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      }
      return new Response('{"status":"In Transit","scans":[]}', { status: 200 });
    };
    const fetcher = (url: string | URL, init?: RequestInit, config: any = {}) =>
      fetchWithRetry(url, init, { ...config, fetchFn: mockFetch, initialDelayMs: 1 });

    const result = await trackDtdcShipment({
      waybill: 'D12345678',
      username: 'tracking-user-refresh',
      password: 'secret',
      configuredAccessToken: 'expired-token',
      isStaging: false,
      fetcher,
    });

    assert.equal(result.data.status, 'In Transit');
    assert.equal(result.tokenRefreshed, true);
    assert.equal(calls.filter(call => call.url.includes('getTrackDetails')).length, 2);
    assert.deepEqual(
      calls.filter(call => call.url.includes('getTrackDetails')).map(call => call.token),
      ['expired-token', 'fresh-token'],
    );
    assert.equal(calls.filter(call => call.url.includes('/authenticate')).length, 1);
  });

  it('returns a safe configuration error when tracking credentials are missing', async () => {
    await assert.rejects(
      () => trackDtdcShipment({
        waybill: 'D12345679',
        username: '',
        password: '',
        isStaging: false,
      }),
      (error: any) => {
        assert.ok(error instanceof DtdcTrackingError);
        assert.match(error.message, /DTDC_USERNAME and DTDC_PASSWORD/);
        return true;
      },
    );
  });
});
