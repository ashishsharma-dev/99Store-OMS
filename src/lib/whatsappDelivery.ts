import type { WhatsAppLog } from './types';
import type { CampaignProgress, WalabzClient } from './walabz';

export const LOGIN_OTP_PREPARING_TIMEOUT_MS = 45_000;
export const MESSAGE_PREPARING_TIMEOUT_MS = 30 * 60_000;

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

export function getWalabzQueueTimeoutReason(
  log: Pick<WhatsAppLog, 'timestamp' | 'templateName'>,
  progress: CampaignProgress,
  now = Date.now(),
): string | undefined {
  const providerStatus = String(progress.status || '').toLowerCase();
  const hasNoRecipients = Number(progress.total || 0) === 0
    && Number(progress.sent || 0) === 0
    && Number(progress.delivered || 0) === 0
    && Number(progress.read || 0) === 0
    && Number(progress.failed || 0) === 0;
  if (!['preparing', 'queued'].includes(providerStatus) || !hasNoRecipients) return undefined;

  const createdAt = Date.parse(log.timestamp);
  if (!Number.isFinite(createdAt)) return undefined;
  const isLoginOtp = String(log.templateName || '').toLowerCase() === 'login_otp';
  const timeoutMs = isLoginOtp ? LOGIN_OTP_PREPARING_TIMEOUT_MS : MESSAGE_PREPARING_TIMEOUT_MS;
  if (now - createdAt < timeoutMs) return undefined;

  const timeoutLabel = isLoginOtp ? '45 seconds' : '30 minutes';
  return `Provider queue timed out after ${timeoutLabel}: campaign remained ${providerStatus} with zero recipients.`;
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
