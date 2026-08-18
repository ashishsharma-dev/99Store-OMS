import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  fetchWithRetry,
  HttpError,
  isRetryableStatusCode,
  getErrorCategory,
  isRetryableError
} from '../src/lib/fetchWithRetry';

describe('Courier Fetch With Retry Unit Tests', () => {

  it('1. Should return successful response on first attempt', async () => {
    let attempts = 0;
    const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      attempts++;
      return new Response(JSON.stringify({ status: 'Delivered', awb: '10001' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const res = await fetchWithRetry(
      'https://api.example.com/track',
      {},
      {
        fetchFn: mockFetch as any,
        awb: '10001',
        courierName: 'Delhivery',
        timeoutMs: 5000,
        maxAttempts: 3,
        initialDelayMs: 10
      }
    );

    assert.strictEqual(attempts, 1);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'Delivered');
  });

  it('2. Should handle ECONNRESET network error followed by successful retry', async () => {
    let attempts = 0;
    const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        const err: any = new TypeError('fetch failed');
        err.cause = { code: 'ECONNRESET' };
        throw err;
      }
      return new Response(JSON.stringify({ status: 'In Transit', awb: '153999418100000' }), { status: 200 });
    };

    const res = await fetchWithRetry(
      'https://api.example.com/track',
      {},
      {
        fetchFn: mockFetch as any,
        awb: '153999418100000',
        courierName: 'XpressBees',
        timeoutMs: 5000,
        maxAttempts: 3,
        initialDelayMs: 10
      }
    );

    assert.strictEqual(attempts, 2);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'In Transit');
  });

  it('3. Should handle Timeout error followed by successful retry', async () => {
    let attempts = 0;
    const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        const err: any = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      }
      return new Response(JSON.stringify({ status: 'Out for Delivery' }), { status: 200 });
    };

    const res = await fetchWithRetry(
      'https://api.example.com/track',
      {},
      {
        fetchFn: mockFetch as any,
        awb: '10003',
        courierName: 'DTDC',
        timeoutMs: 5000,
        maxAttempts: 3,
        initialDelayMs: 10
      }
    );

    assert.strictEqual(attempts, 2);
    assert.strictEqual(res.status, 200);
  });

  it('4. Should fail after three unsuccessful network attempts', async () => {
    let attempts = 0;
    const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      attempts++;
      const err: any = new TypeError('fetch failed');
      err.cause = { code: 'ECONNRESET' };
      throw err;
    };

    await assert.rejects(
      async () => {
        await fetchWithRetry(
          'https://api.example.com/track',
          {},
          {
            fetchFn: mockFetch as any,
            awb: '10004',
            courierName: 'Velocity',
            timeoutMs: 5000,
            maxAttempts: 3,
            initialDelayMs: 10
          }
        );
      },
      (err: any) => {
        return err.cause?.code === 'ECONNRESET' || err.message.includes('fetch failed');
      }
    );

    assert.strictEqual(attempts, 3);
  });

  it('5. Should NOT retry for HTTP 400/401/404 client errors', async () => {
    let attempts = 0;
    const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      attempts++;
      return new Response(JSON.stringify({ error: 'Waybill Not Found' }), {
        status: 404,
        statusText: 'Not Found'
      });
    };

    await assert.rejects(
      async () => {
        await fetchWithRetry(
          'https://api.example.com/track',
          {},
          {
            fetchFn: mockFetch as any,
            awb: '10005',
            courierName: 'Delhivery',
            timeoutMs: 5000,
            maxAttempts: 3,
            initialDelayMs: 10,
            validateStatus: true
          }
        );
      },
      (err: any) => {
        assert.ok(err instanceof HttpError);
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.isRetryable, false);
        return true;
      }
    );

    assert.strictEqual(attempts, 1);
  });

  it('6. Should retry for HTTP 429 and HTTP 503 errors', async () => {
    let attempts = 0;
    const mockFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        return new Response('Rate limited', { status: 429, statusText: 'Too Many Requests' });
      }
      if (attempts === 2) {
        return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
      }
      return new Response(JSON.stringify({ status: 'Delivered' }), { status: 200 });
    };

    const res = await fetchWithRetry(
      'https://api.example.com/track',
      {},
      {
        fetchFn: mockFetch as any,
        awb: '10006',
        courierName: 'XpressBees',
        timeoutMs: 5000,
        maxAttempts: 3,
        initialDelayMs: 10
      }
    );

    assert.strictEqual(attempts, 3);
    assert.strictEqual(res.status, 200);
  });

  it('7. Should handle multiple AWBs where one fails and others succeed', async () => {
    const awbs = ['AWB-SUCCESS-1', 'AWB-FAIL-404', 'AWB-SUCCESS-2'];

    const mockFetch = async (url: string | URL): Promise<Response> => {
      const urlStr = url.toString();
      if (urlStr.includes('AWB-FAIL-404')) {
        return new Response('Invalid AWB', { status: 404, statusText: 'Not Found' });
      }
      return new Response(JSON.stringify({ status: 'In Transit' }), { status: 200 });
    };

    const results = await Promise.allSettled(
      awbs.map((awb) =>
        fetchWithRetry(
          `https://api.example.com/track?awb=${awb}`,
          {},
          {
            fetchFn: mockFetch as any,
            awb,
            courierName: 'DTDC',
            timeoutMs: 5000,
            maxAttempts: 3,
            initialDelayMs: 10
          }
        )
      )
    );

    assert.strictEqual(results[0].status, 'fulfilled');
    assert.strictEqual(results[1].status, 'rejected');
    assert.strictEqual(results[2].status, 'fulfilled');
  });
});
