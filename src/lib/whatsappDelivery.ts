import type { WhatsAppLog } from './types';
import type { CampaignProgress, WalabzClient } from './walabz';

const FAILURE_FIELDS = [
  'error_message',
  'failure_reason',
  'provider_error_message',
  'reason',
  'error',
  'detail',
] as const;

function readableProviderError(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    for (const field of FAILURE_FIELDS) {
      const nested = readableProviderError((value as Record<string, unknown>)[field]);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function getWalabzLogStatus(progress: CampaignProgress): WhatsAppLog['status'] | null {
  const read = Number(progress.read || 0);
  const delivered = Number(progress.delivered || 0);
  const sent = Number(progress.sent || 0);
  const failed = Number(progress.failed || 0);
  const providerStatus = String(progress.status || '').toLowerCase();

  if (read > 0) return 'Read';
  if (delivered > 0) return 'Delivered';
  if (failed > 0) return 'Failed';
  if (sent > 0 || providerStatus === 'completed') return 'Sent';
  if (providerStatus === 'failed') return 'Failed';
  return null;
}

export async function getWalabzFailureReason(
  client: Pick<WalabzClient, 'getCampaignMessages'>,
  campaignId: string,
): Promise<string | undefined> {
  try {
    const messages = await client.getCampaignMessages(campaignId);
    for (const message of messages) {
      const reason = readableProviderError(message);
      if (reason) return reason;
    }
  } catch (error) {
    console.warn(`[WhatsApp reconciliation] Could not read provider report for campaign ${campaignId}:`, error);
  }
  return undefined;
}
