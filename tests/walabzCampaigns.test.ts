import assert from 'node:assert/strict';
import { afterEach, it, mock } from 'node:test';
import { WalabzClient } from '../src/lib/walabz';

afterEach(() => mock.restoreAll());

it('deletes a stalled campaign shell through the documented campaign endpoint', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method });
    return new Response(null, { status: 204 });
  });
  const client = new WalabzClient({ baseUrl: 'https://labzwaba.com', apiKey: 'test-key' });

  assert.deepEqual(await client.deleteCampaign('campaign-id'), { success: true });
  assert.deepEqual(calls, [{ url: 'https://labzwaba.com/api/campaigns/campaign-id', method: 'DELETE' }]);
});

it('reports a provider refusal without pretending the queue was cleared', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Campaign cannot be deleted' }, { status: 409 }));
  const client = new WalabzClient({ baseUrl: 'https://labzwaba.com', apiKey: 'test-key' });

  const result = await client.deleteCampaign('campaign-id');
  assert.equal(result.success, false);
  assert.match(result.error || '', /cannot be deleted/i);
});
