import type { WhatsAppLog } from './types';

const DEFAULT_STALL_AGE_MS = 2 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export function isWalabzQueueBlocked(
  logs: WhatsAppLog[],
  now = Date.now(),
  stallAgeMs = DEFAULT_STALL_AGE_MS,
): boolean {
  return logs.some(log => {
    if (!log.campaignId) return false;
    const createdAt = Date.parse(log.timestamp);
    if (!Number.isFinite(createdAt) || now - createdAt < stallAgeMs || now - createdAt > DEFAULT_LOOKBACK_MS) return false;

    const providerStatus = String(log.providerStatus || '').toLowerCase();
    if (providerStatus === 'preparing' || providerStatus === 'queued') return true;

    return log.status === 'Queued'
      && !log.lastProviderSyncAt
      && !providerStatus;
  });
}

export function assertExpectedTemplateCategory(
  category: string | undefined,
  expected: 'utility' | 'authentication',
  templateName: string,
): void {
  if (!category) return;
  if (category.toLowerCase() !== expected) {
    throw new Error(`WhatsApp template '${templateName}' is categorized as ${category}; expected ${expected}.`);
  }
}

export function getOutboxRetryAt(retryCount: number, now = Date.now()): string {
  const delayMs = Math.min(30 * 60 * 1000, 30_000 * (2 ** Math.min(retryCount, 6)));
  return new Date(now + delayMs).toISOString();
}
