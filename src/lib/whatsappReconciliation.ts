import { db } from './db';
import type { WhatsAppLog } from './types';
import { getWalabzClient } from './whatsapp';
import { getWalabzFailureReason, getWalabzLogStatus, getWalabzQueueTimeoutReason } from './whatsappDelivery';

type ReconciliationResult = { checked: number; updated: number; failed: number };
const shared = globalThis as typeof globalThis & {
  whatsappReconciliationRun?: Promise<ReconciliationResult>;
  whatsappReconciliationTimer?: ReturnType<typeof setTimeout>;
};

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

export function reconcileWhatsAppLogs(): Promise<ReconciliationResult> {
  if (shared.whatsappReconciliationRun) return shared.whatsappReconciliationRun;

  shared.whatsappReconciliationRun = (async () => {
    const batchSize = boundedNumber(process.env.WHATSAPP_RECONCILIATION_BATCH_SIZE, 50, 1, 100);
    const logs = await db.getWhatsAppLogsForReconciliation(batchSize);
    if (logs.length === 0) return { checked: 0, updated: 0, failed: 0 };

    const client = logs.some(log => Boolean(log.campaignId)) ? await getWalabzClient() : null;
    let updated = 0;
    let failed = 0;
    const concurrency = 5;
    const unreconcilableAgeMs = boundedNumber(
      process.env.WHATSAPP_UNRECONCILABLE_AGE_MS,
      60 * 60 * 1000,
      15 * 60 * 1000,
      7 * 24 * 60 * 60 * 1000,
    );

    for (let index = 0; index < logs.length; index += concurrency) {
      await Promise.all(logs.slice(index, index + concurrency).map(async (log: WhatsAppLog) => {
        try {
          if (!log.campaignId) {
            const ageMs = Date.now() - Date.parse(log.timestamp);
            if (Number.isFinite(ageMs) && ageMs >= unreconcilableAgeMs) {
              log.status = 'Failed';
              log.providerStatus = 'unreconcilable';
              log.lastProviderSyncAt = new Date().toISOString();
              log.errorDetail = 'Cannot reconcile this message because no Walabz campaign ID was recorded.';
              await db.saveWhatsAppLog(log);
              updated += 1;
            }
            return;
          }
          if (!client) throw new Error('Walabz client was not initialized.');
          const progress = await client.getCampaignProgress(log.campaignId!);
          const nextStatus = getWalabzLogStatus(progress);
          const queueTimeoutReason = getWalabzQueueTimeoutReason(log, progress);
          const previousStatus = log.status;
          const previousErrorDetail = log.errorDetail;
          log.providerStatus = String(progress.status || 'unknown');
          log.lastProviderSyncAt = new Date().toISOString();

          if (queueTimeoutReason) {
            log.status = 'Failed';
            log.errorDetail = queueTimeoutReason;
          } else if (nextStatus) {
            log.status = nextStatus;
            if (nextStatus === 'Failed') {
              log.errorDetail = await getWalabzFailureReason(client, log.campaignId!)
                || 'Walabz failed to send the campaign. No message-level reason was returned.';
            } else {
              delete log.errorDetail;
            }
          }

          await db.saveWhatsAppLog(log);
          if (log.status !== previousStatus || log.errorDetail !== previousErrorDetail) updated += 1;
        } catch (error) {
          failed += 1;
          console.warn(`[WhatsApp reconciliation] Campaign ${log.campaignId} could not be reconciled:`, error);
        }
      }));
    }

    return { checked: logs.length, updated, failed };
  })().finally(() => {
    shared.whatsappReconciliationRun = undefined;
  });

  return shared.whatsappReconciliationRun;
}

export function startWhatsAppReconciliationScheduler(): void {
  if (shared.whatsappReconciliationTimer) return;
  const intervalMs = boundedNumber(process.env.WHATSAPP_RECONCILIATION_INTERVAL_MS, 120_000, 30_000, 900_000);
  const tick = async () => {
    try {
      const result = await reconcileWhatsAppLogs();
      if (result.updated > 0 || result.failed > 0) console.log('[WhatsApp reconciliation]', result);
    } catch (error) {
      console.error('[WhatsApp reconciliation]', error);
    } finally {
      shared.whatsappReconciliationTimer = setTimeout(tick, intervalMs);
      shared.whatsappReconciliationTimer.unref();
    }
  };
  shared.whatsappReconciliationTimer = setTimeout(tick, 15_000);
  shared.whatsappReconciliationTimer.unref();
}
