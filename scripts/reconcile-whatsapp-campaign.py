#!/usr/bin/env python3
"""Reconcile one production Walabz campaign using the app's provider client."""

from __future__ import annotations

import base64
import json
import sys

import paramiko

from deploy import APP_DIR, VPS_HOST, VPS_PASS, VPS_USER


REMOTE_TS = r"""
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { db } = await import('./src/lib/db');
const { getWalabzClient } = await import('./src/lib/whatsapp');
const { getWalabzFailureReason, getWalabzLogStatus } = await import('./src/lib/whatsappDelivery');

const campaignId = __CAMPAIGN_ID__;
const result = await db.queryWhatsAppLogs(1, 100, campaignId);
const log = result.items.find(item => item.campaignId === campaignId);
if (!log) throw new Error('Campaign log not found');
const client = await getWalabzClient();
const progress = await client.getCampaignProgress(campaignId);
const status = getWalabzLogStatus(progress);
if (status) log.status = status;
log.providerStatus = String(progress.status || 'unknown');
log.lastProviderSyncAt = new Date().toISOString();
if (log.status === 'Failed') {
  log.errorDetail = await getWalabzFailureReason(client, campaignId)
    || 'Walabz failed to send the campaign. No message-level reason was returned.';
} else {
  delete log.errorDetail;
}
await db.saveWhatsAppLog(log);
console.log(JSON.stringify({ campaignId, status: log.status, providerStatus: log.providerStatus, errorDetail: log.errorDetail }));
"""


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('Usage: reconcile-whatsapp-campaign.py CAMPAIGN_ID')
    remote_ts = REMOTE_TS.replace('__CAMPAIGN_ID__', json.dumps(sys.argv[1]))
    encoded = base64.b64encode(remote_ts.encode()).decode()
    command = f"cd {APP_DIR} && printf %s {encoded} | base64 -d | npx tsx"

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)
    try:
        _, stdout, stderr = client.exec_command(command, timeout=90)
        output = stdout.read().decode(errors='replace')
        error = stderr.read().decode(errors='replace')
        status = stdout.channel.recv_exit_status()
        if status != 0:
            raise RuntimeError(error.strip() or f'remote command failed with {status}')
        print(output.strip())
    finally:
        client.close()


if __name__ == '__main__':
    main()
