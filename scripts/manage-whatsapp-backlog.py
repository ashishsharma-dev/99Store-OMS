#!/usr/bin/env python3
"""Audit or safely clear/replay stalled production WhatsApp campaigns."""

from __future__ import annotations

import argparse
import base64
import json
import sys

import paramiko

from deploy import APP_DIR, VPS_HOST, VPS_PASS, VPS_USER


REMOTE_TS = r"""
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { getDatabase } = await import('./src/lib/mongodb');
const { getWalabzClient, triggerWhatsAppNotification } = await import('./src/lib/whatsapp');
const { reconcileWhatsAppLogs } = await import('./src/lib/whatsappReconciliation');

const execute = __EXECUTE__;
const cutoff = __CUTOFF__;
const database = await getDatabase();
if (!database) throw new Error('MongoDB is unavailable.');
const collection = database.collection('whatsappLogs');
const client = await getWalabzClient();

const rows = await collection.find({
  timestamp: { $gte: cutoff },
  campaignId: { $type: 'string' },
  $or: [
    { status: { $in: ['Pending', 'Queued'] } },
    { providerStatus: { $in: ['preparing', 'queued', 'processing'] } },
    { errorDetail: { $regex: 'zero recipients|preparing|queue', $options: 'i' } },
  ],
}).sort({ timestamp: 1 }).limit(500).toArray();

async function mapLimited(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index], index);
    }
  }));
  return output;
}

const inspected = await mapLimited(rows, 5, async log => {
  try {
    const progress = await client.getCampaignProgress(log.campaignId);
    const sent = Number(progress.sent || 0);
    const delivered = Number(progress.delivered || 0);
    const read = Number(progress.read || 0);
    const failed = Number(progress.failed || 0);
    const providerStatus = String(progress.status || 'unknown').toLowerCase();
    const received = sent + delivered + read > 0;
    const stalled = ['preparing', 'queued', 'processing'].includes(providerStatus) && !received;
    const terminalUndelivered = ['failed', 'completed'].includes(providerStatus) && !received && failed > 0;
    return { log, progress, providerStatus, received, stalled, terminalUndelivered };
  } catch (error) {
    return { log, providerStatus: 'inspection_error', received: false, stalled: false, terminalUndelivered: false, error: error instanceof Error ? error.message : String(error) };
  }
});

const received = inspected.filter(item => item.received);
const candidates = inspected.filter(item => item.stalled || item.terminalUndelivered);
const errors = inspected.filter(item => item.error);

const summary = {
  mode: execute ? 'execute' : 'audit',
  cutoff,
  databaseRows: rows.length,
  replayCandidates: candidates.length,
  alreadyReceived: received.length,
  inspectionErrors: errors.length,
  byTemplate: Object.fromEntries([...new Set(candidates.map(item => String(item.log.templateName || 'unknown')))].map(name => [name, candidates.filter(item => String(item.log.templateName || 'unknown') === name).length])),
  campaigns: candidates.map(item => ({
    campaignId: item.log.campaignId,
    orderId: item.log.orderId,
    templateName: item.log.templateName,
    providerStatus: item.providerStatus,
    timestamp: item.log.timestamp,
  })),
};

if (!execute) {
  console.log(JSON.stringify(summary));
  process.exit(0);
}

const cleared = [];
const clearFailures = [];
for (const item of candidates) {
  if (item.stalled) {
    try {
      const response = await client.deleteCampaign(item.log.campaignId);
      if (!response.success) {
        clearFailures.push({ campaignId: item.log.campaignId, error: response.error });
        continue;
      }
    } catch (error) {
      clearFailures.push({ campaignId: item.log.campaignId, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
  }
  cleared.push(item);
}

if (clearFailures.length > 0) {
  console.log(JSON.stringify({ ...summary, cleared: cleared.length, clearFailures, replayedToOutbox: 0 }));
  process.exit(2);
}

const replayable = [];
const seen = new Set();
for (const item of [...cleared].reverse()) {
  const log = item.log;
  if (String(log.templateName || '').toLowerCase() === 'login_otp') continue;
  if (!log.orderId || !log.templateName) continue;
  const key = `${log.orderId}|${log.templateName}|${log.phone}`.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  replayable.push(item);
}

// Keep one cleared row as a temporary circuit-breaker sentinel while all replay
// requests are converted into local outbox entries. No new provider campaign is
// created until every old provider-owned shell has been retired.
const sentinel = cleared[0]?.log;
for (const item of cleared) {
  if (sentinel && item.log.id === sentinel.id) continue;
  await collection.updateOne({ id: item.log.id }, { $set: {
    status: 'Failed',
    providerStatus: String(item.log.templateName || '').toLowerCase() === 'login_otp' ? 'expired_not_replayed' : 'cleared_for_replay',
    lastProviderSyncAt: new Date().toISOString(),
    errorDetail: 'Stalled provider campaign cleared after confirmed non-delivery.',
  }});
}

if (sentinel) {
  await collection.updateOne({ id: sentinel.id }, { $set: {
    status: 'Failed', providerStatus: 'preparing', lastProviderSyncAt: new Date().toISOString(),
  }});
}

const replayResults = [];
for (const item of replayable.reverse()) {
  const order = await database.collection('orders').findOne({ orderId: item.log.orderId });
  if (!order) {
    replayResults.push({ orderId: item.log.orderId, templateName: item.log.templateName, status: 'skipped_missing_order' });
    continue;
  }
  const logs = await triggerWhatsAppNotification({
    orderId: order.orderId,
    customerName: order.customerName,
    phonePrimary: order.phonePrimary || '',
    phoneSecondary: order.phoneSecondary,
    phoneTertiary: order.phoneTertiary,
    phoneWhatsApp: order.phoneWhatsApp,
    status: item.log.templateName,
    awb: order.awb,
    courier: order.courier,
    eta: order.eta,
    orderValue: order.orderValue,
    paymentType: order.paymentType,
    productName: order.productDetails,
    baseUrl: 'https://oms.ayurvedacare.store',
    isOnDemand: true,
  });
  replayResults.push({
    orderId: order.orderId,
    templateName: item.log.templateName,
    status: logs[0]?.status || 'not_created',
    logId: logs[0]?.id,
  });
}

if (sentinel) {
  await collection.updateOne({ id: sentinel.id }, { $set: {
    status: 'Failed',
    providerStatus: String(sentinel.templateName || '').toLowerCase() === 'login_otp' ? 'expired_not_replayed' : 'cleared_for_replay',
    lastProviderSyncAt: new Date().toISOString(),
    errorDetail: 'Stalled provider campaign cleared after confirmed non-delivery.',
  }});
}

const reconciliation = await reconcileWhatsAppLogs();
console.log(JSON.stringify({
  ...summary,
  cleared: cleared.length,
  expiredOtps: cleared.filter(item => String(item.log.templateName || '').toLowerCase() === 'login_otp').length,
  replayedToOutbox: replayResults.filter(item => item.status === 'Pending').length,
  replayResults,
  reconciliation,
}));
"""


def run_remote(execute: bool, cutoff: str) -> dict:
    remote_ts = REMOTE_TS.replace('__EXECUTE__', 'true' if execute else 'false')
    remote_ts = remote_ts.replace('__CUTOFF__', json.dumps(cutoff))
    encoded = base64.b64encode(remote_ts.encode()).decode()
    command = f"cd {APP_DIR} && printf %s {encoded} | base64 -d | npx tsx"

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)
    try:
      _, stdout, stderr = client.exec_command(command, timeout=900)
      output = stdout.read().decode(errors='replace').strip()
      error = stderr.read().decode(errors='replace').strip()
      status = stdout.channel.recv_exit_status()
      if not output:
          raise RuntimeError(error or f'remote operation failed with status {status}')
      payload = json.loads(output.splitlines()[-1])
      if status not in (0, 2):
          raise RuntimeError(error or f'remote operation failed with status {status}')
      return payload
    finally:
      client.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true', help='Delete stalled provider campaigns and queue safe replays.')
    parser.add_argument('--cutoff', default='2026-11-03T14:00:00.000Z')
    args = parser.parse_args()
    result = run_remote(args.execute, args.cutoff)
    print(json.dumps(result, indent=2))
    if result.get('clearFailures'):
        raise SystemExit(2)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        raise
